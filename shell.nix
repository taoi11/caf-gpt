{ pkgs ? (import <nixpkgs> {}) }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Python
    python312

    # Dependencies
    python312Packages.python-dotenv
    python312Packages.ollama
    python312Packages.mail-parser

    # Development tools
    python312Packages.pylint
  ];
}
