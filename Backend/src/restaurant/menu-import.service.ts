import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { menuCategories, menuImportRuns, menuItems, menuItemVariants } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { parseParkPlazaMenu, type MenuManifest } from './menu-import.parser.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type CategoryRow = typeof menuCategories.$inferSelect;
type ItemRow = typeof menuItems.$inferSelect;
type VariantRow = typeof menuItemVariants.$inferSelect;

export interface MenuImportEntitySummary {
  created: number;
  updated: number;
  unchanged: number;
  unpublished: number;
}

export interface MenuImportSummary {
  mode: 'preview' | 'apply';
  sourceSystem: string;
  sourceDigest: string;
  currency: 'PEN';
  source: MenuManifest['stats'];
  categories: MenuImportEntitySummary;
  items: MenuImportEntitySummary;
  variants: MenuImportEntitySummary;
}

export interface MenuImportResult extends MenuImportSummary {
  runId: string;
}

interface ImportPlan {
  manifest: MenuManifest;
  summary: MenuImportSummary;
  categories: CategoryRow[];
  items: ItemRow[];
  variants: VariantRow[];
}

const emptyEntity = (): MenuImportEntitySummary => ({ created: 0, updated: 0, unchanged: 0, unpublished: 0 });

@Injectable()
export class MenuImportService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  preview(actor: AuthenticatedAccount, markdown: string, context: RequestContext): Promise<MenuImportResult> {
    return this.run(actor, markdown, 'preview', context);
  }

  apply(actor: AuthenticatedAccount, markdown: string, context: RequestContext): Promise<MenuImportResult> {
    return this.run(actor, markdown, 'apply', context);
  }

  private async run(actor: AuthenticatedAccount, markdown: string, mode: 'preview' | 'apply', context: RequestContext): Promise<MenuImportResult> {
    let manifest: MenuManifest;
    try {
      manifest = parseParkPlazaMenu(markdown);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Menu source is invalid');
    }

    const [run] = await this.db.insert(menuImportRuns).values({
      propertyId: actor.propertyId,
      actorAccountId: actor.accountId,
      sourceSystem: manifest.sourceSystem,
      sourceDigest: manifest.sourceDigest,
      mode,
    }).returning({ id: menuImportRuns.id });
    if (!run) throw new Error('Menu import run could not be created');

    try {
      return await this.db.transaction(async (tx) => {
        if (mode === 'apply') await acquirePropertyTransactionLock(tx, actor.propertyId);
        const plan = await this.buildPlan(tx, actor.propertyId, manifest, mode);
        if (mode === 'apply') await this.applyPlan(tx, actor.propertyId, run.id, plan);
        await tx.update(menuImportRuns).set({ status: 'completed', summary: { ...plan.summary }, finishedAt: new Date() })
          .where(and(eq(menuImportRuns.id, run.id), eq(menuImportRuns.propertyId, actor.propertyId)));
        await this.audit.record({
          ...context,
          actorAccountId: actor.accountId,
          propertyId: actor.propertyId,
          eventType: `restaurant.menu_import.${mode}`,
          subjectType: 'menu_import_run',
          subjectId: run.id,
          metadata: { sourceSystem: manifest.sourceSystem, sourceDigest: manifest.sourceDigest, summary: plan.summary },
        }, tx);
        return { runId: run.id, ...plan.summary };
      });
    } catch (error) {
      try {
        await this.db.update(menuImportRuns).set({ status: 'failed', errorMessage: 'Menu import failed', finishedAt: new Date() })
          .where(and(eq(menuImportRuns.id, run.id), eq(menuImportRuns.propertyId, actor.propertyId)));
      } catch {
        // Preserve the original import failure if audit persistence is unavailable.
      }
      throw error;
    }
  }

  private async buildPlan(tx: Transaction, propertyId: string, manifest: MenuManifest, mode: 'preview' | 'apply'): Promise<ImportPlan> {
    const [categories, items, variants] = await Promise.all([
      tx.select().from(menuCategories).where(and(eq(menuCategories.propertyId, propertyId), eq(menuCategories.sourceSystem, manifest.sourceSystem))),
      tx.select().from(menuItems).where(and(eq(menuItems.propertyId, propertyId), eq(menuItems.sourceSystem, manifest.sourceSystem))),
      tx.select().from(menuItemVariants).where(and(eq(menuItemVariants.propertyId, propertyId), eq(menuItemVariants.sourceSystem, manifest.sourceSystem))),
    ]);
    const summary: MenuImportSummary = {
      mode,
      sourceSystem: manifest.sourceSystem,
      sourceDigest: manifest.sourceDigest,
      currency: manifest.currency,
      source: manifest.stats,
      categories: emptyEntity(),
      items: emptyEntity(),
      variants: emptyEntity(),
    };
    const categoryByKey = new Map(categories.map((row) => [row.sourceKey!, row]));
    const itemByKey = new Map(items.map((row) => [row.sourceKey!, row]));
    const variantByKey = new Map(variants.map((row) => [row.sourceKey!, row]));

    for (const desired of manifest.categories) {
      const current = categoryByKey.get(desired.sourceKey);
      if (!current) summary.categories.created += 1;
      else if (current.sourceHash !== desired.sourceHash || current.name !== desired.name || current.position !== desired.position || !current.isPublished) summary.categories.updated += 1;
      else summary.categories.unchanged += 1;
      for (const desiredItem of desired.items) {
        const item = itemByKey.get(desiredItem.sourceKey);
        const publishItem = desiredItem.variants.some((variant) => variant.price !== null);
        const expectedPrice = desiredItem.variants.find((variant) => variant.price !== null)?.price ?? null;
        const expectedCategoryId = categoryByKey.get(desired.sourceKey)?.id;
        const categoryMismatch = expectedCategoryId === undefined || item?.categoryId !== expectedCategoryId;
        if (!item) summary.items.created += 1;
        else if (item.sourceHash !== desiredItem.sourceHash || categoryMismatch || item.name !== desiredItem.name || item.category !== desired.name || item.position !== desiredItem.position || item.salePrice !== expectedPrice || item.currency !== 'PEN' || item.preparationMinutes !== null || item.status !== 'active' || item.isPublished !== publishItem || item.isAvailable !== publishItem) summary.items.updated += 1;
        else summary.items.unchanged += 1;
        for (const desiredVariant of desiredItem.variants) {
          const variant = variantByKey.get(desiredVariant.sourceKey);
          const publishVariant = desiredVariant.price !== null;
          if (!variant) summary.variants.created += 1;
          else if (variant.sourceHash !== desiredVariant.sourceHash || variant.name !== desiredVariant.name || variant.price !== desiredVariant.price || variant.currency !== 'PEN' || variant.position !== desiredVariant.position || variant.status !== 'active' || variant.isPublished !== publishVariant || variant.isAvailable !== publishVariant) summary.variants.updated += 1;
          else summary.variants.unchanged += 1;
        }
      }
    }

    const categoryKeys = new Set(manifest.categories.map((entry) => entry.sourceKey));
    const itemKeys = new Set(manifest.categories.flatMap((entry) => entry.items.map((item) => item.sourceKey)));
    const variantKeys = new Set(manifest.categories.flatMap((entry) => entry.items.flatMap((item) => item.variants.map((variant) => variant.sourceKey))));
    summary.categories.unpublished = categories.filter((row) => !categoryKeys.has(row.sourceKey!) && row.isPublished).length;
    summary.items.unpublished = items.filter((row) => !itemKeys.has(row.sourceKey!) && (row.isPublished || row.isAvailable)).length;
    summary.variants.unpublished = variants.filter((row) => !variantKeys.has(row.sourceKey!) && (row.isPublished || row.isAvailable)).length;
    return { manifest, summary, categories, items, variants };
  }

  private async applyPlan(tx: Transaction, propertyId: string, runId: string, plan: ImportPlan): Promise<void> {
    const now = new Date();
    const categoryByKey = new Map(plan.categories.map((row) => [row.sourceKey!, row]));
    const itemByKey = new Map(plan.items.map((row) => [row.sourceKey!, row]));
    const variantByKey = new Map(plan.variants.map((row) => [row.sourceKey!, row]));
    const categoryIds = new Map<string, string>();
    const itemIds = new Map<string, string>();

    for (const desired of plan.manifest.categories) {
      const current = categoryByKey.get(desired.sourceKey);
      if (current) {
        categoryIds.set(desired.sourceKey, current.id);
        if (current.sourceHash !== desired.sourceHash || current.name !== desired.name || current.position !== desired.position || !current.isPublished) {
          await tx.update(menuCategories).set({ name: desired.name, position: desired.position, isPublished: true, sourceHash: desired.sourceHash, lastImportRunId: runId, updatedAt: now })
            .where(and(eq(menuCategories.id, current.id), eq(menuCategories.propertyId, propertyId), eq(menuCategories.managementMode, 'imported')));
        }
      } else {
        const [created] = await tx.insert(menuCategories).values({ propertyId, name: desired.name, position: desired.position, managementMode: 'imported', sourceSystem: plan.manifest.sourceSystem, sourceKey: desired.sourceKey, sourceHash: desired.sourceHash, lastImportRunId: runId }).returning({ id: menuCategories.id });
        categoryIds.set(desired.sourceKey, created!.id);
      }

      for (const desiredItem of desired.items) {
        const currentItem = itemByKey.get(desiredItem.sourceKey);
        const categoryId = categoryIds.get(desired.sourceKey)!;
        const pricedVariants = desiredItem.variants.filter((variant) => variant.price !== null);
        const publishItem = pricedVariants.length > 0;
        const values = {
          categoryId,
          name: desiredItem.name,
          category: desired.name,
          position: desiredItem.position,
          salePrice: pricedVariants[0]?.price ?? null,
          currency: 'PEN' as const,
          preparationMinutes: null,
          status: 'active',
          isPublished: publishItem,
          isAvailable: publishItem,
          sourceHash: desiredItem.sourceHash,
          lastImportRunId: runId,
          updatedAt: now,
        };
        if (currentItem) {
          itemIds.set(desiredItem.sourceKey, currentItem.id);
          const changed = currentItem.sourceHash !== desiredItem.sourceHash || currentItem.categoryId !== categoryId || currentItem.name !== desiredItem.name || currentItem.category !== desired.name || currentItem.position !== desiredItem.position || currentItem.salePrice !== values.salePrice || currentItem.currency !== 'PEN' || currentItem.preparationMinutes !== null || currentItem.status !== 'active' || currentItem.isPublished !== publishItem || currentItem.isAvailable !== publishItem;
          if (changed) await tx.update(menuItems).set(values).where(and(eq(menuItems.id, currentItem.id), eq(menuItems.propertyId, propertyId), eq(menuItems.managementMode, 'imported')));
        } else {
          const [created] = await tx.insert(menuItems).values({ ...values, propertyId, managementMode: 'imported', sourceSystem: plan.manifest.sourceSystem, sourceKey: desiredItem.sourceKey }).returning({ id: menuItems.id });
          itemIds.set(desiredItem.sourceKey, created!.id);
        }

        for (const desiredVariant of desiredItem.variants) {
          const currentVariant = variantByKey.get(desiredVariant.sourceKey);
          const menuItemId = itemIds.get(desiredItem.sourceKey)!;
          const publishVariant = desiredVariant.price !== null;
          const variantValues = {
            menuItemId,
            name: desiredVariant.name,
            price: desiredVariant.price,
            currency: 'PEN' as const,
            position: desiredVariant.position,
            status: 'active',
            isPublished: publishVariant,
            isAvailable: publishVariant,
            sourceHash: desiredVariant.sourceHash,
            lastImportRunId: runId,
            updatedAt: now,
          };
          if (currentVariant) {
            const changed = currentVariant.sourceHash !== desiredVariant.sourceHash || currentVariant.menuItemId !== menuItemId || currentVariant.name !== desiredVariant.name || currentVariant.price !== desiredVariant.price || currentVariant.currency !== 'PEN' || currentVariant.position !== desiredVariant.position || currentVariant.status !== 'active' || currentVariant.isPublished !== publishVariant || currentVariant.isAvailable !== publishVariant;
            if (changed) await tx.update(menuItemVariants).set(variantValues).where(and(eq(menuItemVariants.id, currentVariant.id), eq(menuItemVariants.propertyId, propertyId), eq(menuItemVariants.managementMode, 'imported')));
          } else {
            await tx.insert(menuItemVariants).values({ ...variantValues, propertyId, managementMode: 'imported', sourceSystem: plan.manifest.sourceSystem, sourceKey: desiredVariant.sourceKey });
          }
        }
      }
    }

    const categoryKeys = new Set(plan.manifest.categories.map((entry) => entry.sourceKey));
    const itemKeys = new Set(plan.manifest.categories.flatMap((entry) => entry.items.map((item) => item.sourceKey)));
    const variantKeys = new Set(plan.manifest.categories.flatMap((entry) => entry.items.flatMap((item) => item.variants.map((variant) => variant.sourceKey))));
    for (const row of plan.variants.filter((entry) => !variantKeys.has(entry.sourceKey!) && (entry.isPublished || entry.isAvailable))) {
      await tx.update(menuItemVariants).set({ isPublished: false, isAvailable: false, lastImportRunId: runId, updatedAt: now }).where(and(eq(menuItemVariants.id, row.id), eq(menuItemVariants.propertyId, propertyId), eq(menuItemVariants.managementMode, 'imported')));
    }
    for (const row of plan.items.filter((entry) => !itemKeys.has(entry.sourceKey!) && (entry.isPublished || entry.isAvailable))) {
      await tx.update(menuItems).set({ isPublished: false, isAvailable: false, lastImportRunId: runId, updatedAt: now }).where(and(eq(menuItems.id, row.id), eq(menuItems.propertyId, propertyId), eq(menuItems.managementMode, 'imported')));
    }
    for (const row of plan.categories.filter((entry) => !categoryKeys.has(entry.sourceKey!) && entry.isPublished)) {
      await tx.update(menuCategories).set({ isPublished: false, lastImportRunId: runId, updatedAt: now }).where(and(eq(menuCategories.id, row.id), eq(menuCategories.propertyId, propertyId), eq(menuCategories.managementMode, 'imported')));
    }
  }
}
