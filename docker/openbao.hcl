# Minimal non-dev OpenBao config used when BAO_DEV != 1.
# OpenBao only listens on loopback; the Next.js BFF is the public entry point
# and proxies /v1/* to this listener inside the container.
#
# NOTE: with file storage the instance starts SEALED and UNINITIALIZED. You must
# initialize + unseal it (via the API/CLI) before the UI can be used. For a
# quick start prefer dev mode (BAO_DEV=1). Production deployments should mount a
# real config/storage and TLS termination.

ui = false

storage "file" {
  path = "/bao/file"
}

listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = true
}

# Disable mlock for container portability; review for hardened deployments.
disable_mlock = true

# Declarative file audit device. OpenBao disables enabling audit devices over
# the API, so they are configured here; the UI's audit-log viewer reads this
# file. The device attaches once the instance is unsealed.
audit "file" "file" {
  options {
    file_path = "/bao/file/audit.log"
  }
}

