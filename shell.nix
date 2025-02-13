{ pkgs ? (import <nixpkgs> {}) }:

pkgs.mkShell {
  buildInputs = [
    # Node.js and npm
    pkgs.nodejs_23

    # Development tools
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    pkgs.nodePackages.eslint
  ];

  shellHook = ''
    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
  '';
}
