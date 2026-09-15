-- A settled result the sources disagreed on. The primary source's value is
-- stored and shown; the flag marks it for review rather than hiding the
-- disagreement or letting something guess a winner.
ALTER TABLE "Match" ADD COLUMN "disputed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "disputedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
