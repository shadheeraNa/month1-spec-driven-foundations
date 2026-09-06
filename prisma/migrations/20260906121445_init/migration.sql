-- CreateTable
CREATE TABLE "Owner" (
    "name" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    CONSTRAINT "Ticket_ownerName_fkey" FOREIGN KEY ("ownerName") REFERENCES "Owner" ("name") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Ticket_ownerName_idx" ON "Ticket"("ownerName");
