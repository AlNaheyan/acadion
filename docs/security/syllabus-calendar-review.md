# Syllabus Calendar Security Review

## Trust boundaries

- Uploaded PDFs are untrusted. Imports require PDF MIME type, extension, signature, a 10 MB limit, at most 100 extracted pages, and at most 500,000 extracted characters.
- Syllabus text is data, not instructions. The model prompt states this explicitly and escapes the closing document delimiter before submission.
- Model output is untrusted and must pass the strict canonical schema, evidence verification, and conservative date validation before persistence or export.

## Authorization and data

- Course reads are scoped by both authenticated Clerk user ID and course ID.
- Supabase RLS independently limits browser reads to rows owned through the Clerk JWT subject.
- Calendar event claims verify that the connection and course share an owner. The security-definer RPC is unavailable to anonymous and authenticated browser roles.
- Calendar provider IDs and status may be retained. Raw provider errors and OAuth tokens are not exposed to browser responses.

## OAuth and secrets

- OAuth state is random, encrypted, bound to the authenticated user, expires after ten minutes, and is stored in HttpOnly SameSite cookies.
- Authorization uses PKCE. Refresh/access tokens are encrypted with AES-256-GCM and remain server-only.
- Production callback URLs must use HTTPS. Client secrets and `OAUTH_TOKEN_ENCRYPTION_KEY` belong only in deployment environment storage.
- Disconnect deletes locally stored credentials and revokes Google tokens.

## Residual operational requirements

- Rotate OAuth client secrets and the token-encryption key through a planned credential migration.
- Configure provider redirect URIs exactly and run live OAuth smoke tests before release.
- Monitor failed imports and provider calls using privacy-safe event metadata, never syllabus text or tokens.
