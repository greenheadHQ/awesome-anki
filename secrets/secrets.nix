let
  user = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDN048Qg9ABnM26jU0X0w2mG9pqcrwuVrcihvDbkRVX8";
  host = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBCKdChiudotK9ZSCEnlmztdfW61rV7P3ucOO+X74ici";
  allKeys = [ user host ];
in
{
  "gemini-api-key.age".publicKeys = allKeys;
  "openai-api-key.age".publicKeys = allKeys;
  "anki-splitter-api-key.age".publicKeys = allKeys;
}
