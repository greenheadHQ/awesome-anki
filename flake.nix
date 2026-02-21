{
  description = "Anki Card Splitter dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    agenix = {
      url = "github:ryantm/agenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, agenix }:
    let
      system = "aarch64-darwin";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pkgs.bun
          pkgs.biome
          pkgs.gh
          pkgs.lefthook
          pkgs.gitleaks
          agenix.packages.${system}.default
        ];

        shellHook = ''
          lefthook install
        '';
      };
    };
}
