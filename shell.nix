{ pkgs ? (import <nixpkgs> {}) }:

pkgs.mkShell {
  buildInputs = [
    # Node.js and npm
    pkgs.nodejs_23

    # Basic development tools
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server

  ];

  shellHook = ''
    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
  '';
}
