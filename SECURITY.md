# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.1.x | Yes |
| < 1.1 | Best effort |

The plugin targets DeepSeek Harness 0.2.x. Please include the DSH build/version
and the plugin version in reports.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting:
<https://github.com/Fantety/dsh-pixel-studio/security/advisories/new>

If that is unavailable, open a minimal public issue asking for a private
contact channel; do not include exploit details or secrets.

Include:

- affected plugin version and DSH version;
- platform and Node version;
- reproduction steps or a proof of concept;
- security impact and any known mitigation.

## Scope

dsh-pixel-studio is a local plugin. It:

- reads the Session working directory and writes generated assets under
  `outputDir`;
- accepts structured grids, palettes, frame timings and output paths from the
  model;
- embeds palette-indexed frame data in tool presentation metadata;
- does not make network requests and does not execute user-provided code in the
  host process.

Relevant classes of issues include path traversal or unexpected file writes,
unbounded allocation, malformed GIF/PNG/OYPX output, client-side script
injection through filenames or palette labels, and denial of service in the
inline canvas decoder.

Path handling and generated file limits are enforced in the host half. The
client half decodes only generated metadata and renders it with Canvas APIs.

## Disclosure

We aim to acknowledge reports within 5 business days and coordinate a fix and
disclosure date with the reporter. Please allow reasonable time before public
disclosure.
