-- Which division of its country a competition is. Everything already stored is
-- a top flight or a European cup, so 1 is the right answer for every existing
-- row; the Championship arrives as 2.
ALTER TABLE "Competition" ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 1;
