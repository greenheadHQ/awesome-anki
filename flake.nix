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
      # Single developer, Apple Silicon only. No flake-utils needed.
      system = "aarch64-darwin";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pkgs.bun
          pkgs.nodejs # npx for .mcp.json (chrome-devtools-mcp)
          pkgs.oxlint
          pkgs.oxfmt
          pkgs.jq  # PostToolUse hook 스크립트 의존성
          pkgs.gh
          pkgs.lefthook
          pkgs.gitleaks
          agenix.packages.${system}.default
        ];

        shellHook = ''
          # worktree 환경에서 공유 config에 남은 core.hooksPath를 정리
          # (lefthook 2.x는 core.hooksPath가 설정되어 있으면 install을 거부함)
          git config --unset-all --local core.hooksPath 2>/dev/null || true
          lefthook install
        '';
      };
    };
}
