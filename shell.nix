{ pkgs ? (import <nixpkgs> {}) }:
pkgs.mkShell {
  buildInputs = [
    # Node.js and npm
    pkgs.nodejs_23
  ];
}
