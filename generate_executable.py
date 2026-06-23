import os
import sys

import PyInstaller.__main__

from pibs import __version__

# Resolve everything relative to this file so the script works regardless of the
# current working directory it is invoked from.
ROOT = os.path.dirname(os.path.abspath(__file__))


def _find_pyz_line(content):
    """Return the index of the `pyz = PYZ(...)` line in a .spec file.

    The exact contents of this line varies between PyInstaller versions
    (e.g. 5.x emits `pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)`
    while 6.x emits `pyz = PYZ(a.pure)`), so match on the prefix instead of
    the full string.
    """
    for index, line in enumerate(content):
        if line.lstrip().startswith("pyz = PYZ"):
            return index
    raise RuntimeError("Could not locate the `pyz = PYZ(...)` line in the generated .spec file.")


def generate_executables(mult_file: bool = False):
    name = "PIBSv" + __version__

    sep = os.pathsep  # ':' on POSIX, ';' on Windows

    options = [
        os.path.join(ROOT, "run_pibs.py"),
        "--clean",
        "--noconfirm",
        "--windowed",
        "--icon=" + os.path.join(ROOT, "pibs", "ui", "logo.ico"),
        "--name=" + name,
        "--debug=all",
        "--noupx",
        f"--add-data={os.path.join(ROOT, 'pibs', 'ballistics', 'resource')}{sep}ballistics/resource/",
        f"--add-data={os.path.join(ROOT, 'pibs', 'ui')}{sep}ui/",
        f"--add-data={os.path.join(ROOT, 'pibs', 'examples')}{sep}examples/",
    ] + (["--onefile"] if not mult_file else [])

    PyInstaller.__main__.run(options)

    spec_path = os.path.join(ROOT, name + ".spec")

    with open(spec_path, "r") as f:
        content = f.readlines()

    i = _find_pyz_line(content)

    dll_exclusion = """# exclude excessive DLL collected by pyinstaller
key_words = ['api-ms-win']
new_binaries = []
excluded = []
for item in a.binaries:
    name, _, _ = item
    to_include = True
    for key_word in key_words:
        if key_word in name:
            to_include = False
    if to_include:
        new_binaries.append(item)
    else:
        excluded.append(item)

a.binaries = new_binaries
"""

    for line in dll_exclusion.split("\n"):
        content.insert(i, line + "\n")
        i += 1

    with open(spec_path, "w") as f:
        f.writelines(content)

    # Invoke PyInstaller through the current interpreter rather than relying on a
    # `pyinstaller` executable being on PATH (it may not be when the venv is not
    # activated). Raise on failure so the error is not swallowed silently.
    exit_code = os.system(f'"{sys.executable}" -m PyInstaller "{spec_path}" --noconfirm')
    if exit_code != 0:
        raise RuntimeError(f"PyInstaller failed while building from the patched spec (exit code {exit_code}).")


if __name__ == "__main__":
    generate_executables(False)
    generate_executables(True)
