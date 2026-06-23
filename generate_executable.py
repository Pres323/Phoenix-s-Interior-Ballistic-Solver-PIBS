import os
import sys

import PyInstaller.__main__

from pibs import __version__

# Resolve everything relative to this file so the script works regardless of the
# current working directory it is invoked from.
ROOT = os.path.dirname(os.path.abspath(__file__))


def _check_required_paths():
    """Validate that the project files are present next to this script.

    PyInstaller's own error ("Script file '...' does not exist.") is cryptic
    when the project tree is incomplete or the script was copied out of the
    repository. Fail early with an actionable message listing what is actually
    in ROOT instead.
    """
    required = [
        os.path.join(ROOT, "run_pibs.py"),
        os.path.join(ROOT, "pibs"),
        os.path.join(ROOT, "pibs", "ui", "logo.ico"),
        os.path.join(ROOT, "pibs", "ballistics", "resource"),
        os.path.join(ROOT, "pibs", "examples"),
    ]
    missing = [path for path in required if not os.path.exists(path)]
    if missing:
        listing = "\n".join("  - " + entry for entry in sorted(os.listdir(ROOT)))
        raise SystemExit(
            "ERROR: generate_executable.py cannot find the project files it needs.\n"
            f"Script directory (ROOT): {ROOT}\n"
            "Missing:\n" + "\n".join("  - " + path for path in missing) + "\n\n"
            "This usually means the script was copied out of the repository, or the\n"
            "download/extraction is incomplete. Run it from inside a full checkout of\n"
            "the project (the folder that contains run_pibs.py and the pibs/ package).\n\n"
            f"Contents of {ROOT}:\n" + listing
        )


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

    spec_path = os.path.join(ROOT, name + ".spec")
    dist_path = os.path.join(ROOT, "dist")
    work_path = os.path.join(ROOT, "build")

    options = [
        os.path.join(ROOT, "run_pibs.py"),
        "--clean",
        "--noconfirm",
        "--windowed",
        "--icon=" + os.path.join(ROOT, "pibs", "ui", "logo.ico"),
        "--name=" + name,
        "--debug=all",
        "--noupx",
        # Pin the output locations to the project root. PyInstaller captures its
        # default spec/dist/work paths from the current working directory at
        # *import* time, so without these the build would land wherever the
        # script happened to be launched from (e.g. the editor's folder).
        "--specpath=" + ROOT,
        "--distpath=" + dist_path,
        "--workpath=" + work_path,
        f"--add-data={os.path.join(ROOT, 'pibs', 'ballistics', 'resource')}{sep}ballistics/resource/",
        f"--add-data={os.path.join(ROOT, 'pibs', 'ui')}{sep}ui/",
        f"--add-data={os.path.join(ROOT, 'pibs', 'examples')}{sep}examples/",
    ] + (["--onefile"] if not mult_file else [])

    PyInstaller.__main__.run(options)

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
    exit_code = os.system(
        f'"{sys.executable}" -m PyInstaller "{spec_path}" --noconfirm '
        f'--distpath "{dist_path}" --workpath "{work_path}"'
    )
    if exit_code != 0:
        raise RuntimeError(f"PyInstaller failed while building from the patched spec (exit code {exit_code}).")


if __name__ == "__main__":
    _check_required_paths()
    # Build from the project root so PyInstaller's work/dist folders and the
    # generated .spec land alongside the project rather than in whatever
    # directory the script happened to be launched from.
    os.chdir(ROOT)
    generate_executables(False)
    generate_executables(True)
