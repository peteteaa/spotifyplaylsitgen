-- Chosen profile picture (an id from src/avatars.ts). NULL = a default picked from the user id.
ALTER TABLE users ADD COLUMN avatar TEXT;
