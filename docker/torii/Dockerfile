# syntax=docker/dockerfile:1.8
ARG TARGETPLATFORM=linux/amd64
FROM --platform=${TARGETPLATFORM} docker.io/library/rust:1.90.0-bookworm@sha256:3f6e6f8d8725a65a2db964bb828850f888d430c68784d661f753144e5d787207 AS build

ARG TORII_SOURCE_COMMIT=fe3ed0ffa1b0ae2f546d13ff390caf404943df02
ARG TORII_PATCH_SHA256=107fac3616ddf0e8c330782292242a132e4d932d8f4d600aa29f5276a230cb53

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        clang \
        cmake \
        git \
        libssl-dev \
        pkg-config \
        protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src/torii
RUN git init \
    && git remote add origin https://github.com/dojoengine/torii.git \
    && git fetch --depth=1 origin "${TORII_SOURCE_COMMIT}" \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "${TORII_SOURCE_COMMIT}"

COPY patches/ /patches/
RUN test "$(sha256sum /patches/0001-marketplace-hardening.patch | cut -d ' ' -f 1)" = "${TORII_PATCH_SHA256}" \
    && git apply --check /patches/*.patch \
    && git apply /patches/*.patch \
    && cargo fmt --all -- --check \
    && cargo test --locked -p torii-processors fetch::tests \
    && cargo build --locked --release --bin torii

FROM --platform=${TARGETPLATFORM} docker.io/library/debian:bookworm-slim@sha256:1def178129dfb5f24db43afbf2fcac04530012e3264ba4ff81c71184e17a9ee4

ARG TORII_SOURCE_COMMIT=fe3ed0ffa1b0ae2f546d13ff390caf404943df02

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates gettext-base tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 torii \
    && useradd --system --uid 10001 --gid torii --home-dir /var/lib/torii torii \
    && install --directory --owner=torii --group=torii /data /run/torii /var/lib/torii

COPY --from=build /src/torii/target/release/torii /usr/local/bin/torii
COPY --chown=torii:torii config/ /etc/torii/config/
COPY --chown=torii:torii migrations/ /etc/torii/migrations/
COPY --chmod=755 scripts/entrypoint.sh /usr/local/bin/marketplace-torii-entrypoint

LABEL org.opencontainers.image.source="https://github.com/dojoengine/torii" \
      org.opencontainers.image.revision="${TORII_SOURCE_COMMIT}" \
      org.opencontainers.image.title="Biblio hardened marketplace Torii"

USER 10001:10001
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/marketplace-torii-entrypoint"]
