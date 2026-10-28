-- CreateTable
CREATE TABLE "AnalysisRecord" (
    "id" TEXT NOT NULL,
    "registeredDomain" TEXT,
    "status" TEXT NOT NULL,
    "category" TEXT,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisRecord_expiresAt_idx" ON "AnalysisRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "AnalysisRecord_registeredDomain_idx" ON "AnalysisRecord"("registeredDomain");

-- CreateIndex
CREATE INDEX "AnalysisRecord_createdAt_idx" ON "AnalysisRecord"("createdAt");
