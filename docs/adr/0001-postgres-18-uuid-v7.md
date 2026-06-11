# Postgres 18.3 for UUID v7 Transaction IDs

Finance transactions use database-generated UUID v7 identifiers, so the PostgreSQL image is upgraded to 18.3 where UUID v7 generation is built in. This keeps identifiers globally unique while preserving timestamp locality for insertion and ordering, without adding app-side ID generation or custom database functions.
