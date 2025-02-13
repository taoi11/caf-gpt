{ pkgs ? (import <nixpkgs> {}) }:

pkgs.mkShell {
  buildInputs = [
    # Python
    pkgs.python312

    # Python packages
    pkgs.python312Packages.fastapi
    pkgs.python312Packages.uvicorn
    pkgs.python312Packages.python-dotenv
    pkgs.python312Packages.httpx

    # Development tools
    pkgs.python312Packages.pylint
  ];

  shellHook = ''
    echo "Python version: $(python --version)"
    echo "Pip version: $(pip --version)"
  '';
}
