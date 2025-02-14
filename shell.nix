{ pkgs ? (import <nixpkgs> {}) }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Python
    python312

    # Dependencies
    python312Packages.fastapi
    python312Packages.uvicorn
    python312Packages.python-dotenv
    python312Packages.httpx
    python312Packages.ollama

    # Development tools
    python312Packages.pylint
  ];
}
