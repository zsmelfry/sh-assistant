<template>
  <div class="productList">
    <div v-if="store.productsLoading" class="loadingState">加载中...</div>

    <template v-else>
      <div v-if="store.products.length === 0" class="emptyState">
        <p class="emptyHint">暂无产品档案</p>
      </div>

      <div v-else class="listItems">
        <div
          v-for="product in store.products"
          :key="product.id"
          class="productItem"
          :class="{ active: product.isActive }"
        >
          <div class="productInfo">
            <div class="productNameRow">
              <span class="productName">{{ product.name }}</span>
              <span v-if="product.isActive" class="activeBadge">当前</span>
            </div>
            <span class="productStage">{{ PRODUCT_STAGE_LABELS[product.currentStage] }}</span>
          </div>
          <div class="productActions">
            <button
              v-if="!product.isActive"
              class="actionBtn activate"
              @click="handleActivate(product.id)"
            >
              设为当前
            </button>
            <button
              v-if="!product.isActive"
              class="actionBtn delete"
              @click="handleDelete(product)"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Confirm delete dialog -->
    <Teleport to="body">
      <div v-if="confirmTarget" class="dialogOverlay" @click.self="confirmTarget = null">
        <div class="dialogBox">
          <p class="dialogText">
            确定删除产品「{{ confirmTarget.name }}」吗？<br />
            该产品下的笔记也将被删除。
          </p>
          <div class="dialogActions">
            <button class="dialogBtn cancel" @click="confirmTarget = null">取消</button>
            <button class="dialogBtn confirm" @click="doDelete">确认删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useStartupMapProductStore } from '~/stores/startup-map';
import { PRODUCT_STAGE_LABELS } from '../types';
import type { SmProduct } from '../types';

const store = useStartupMapProductStore();
const confirmTarget = ref<SmProduct | null>(null);

onMounted(() => {
  store.loadProducts();
});

async function handleActivate(id: number) {
  await store.activateProduct(id);
}

function handleDelete(product: SmProduct) {
  confirmTarget.value = product;
}

async function doDelete() {
  if (!confirmTarget.value) return;
  const id = confirmTarget.value.id;
  confirmTarget.value = null;
  await store.deleteProduct(id);
}
</script>

<style scoped>
.loadingState {
  text-align: center;
  padding: var(--spacing-md);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.emptyState {
  text-align: center;
  padding: var(--spacing-md);
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.listItems {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.productItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.productItem.active {
  border-color: var(--color-accent);
}

.productInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.productNameRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.productName {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.activeBadge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.productStage {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.productActions {
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.actionBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.actionBtn.activate {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.actionBtn.activate:hover {
  opacity: 0.85;
}

.actionBtn.delete {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.actionBtn.delete:hover {
  background: var(--color-bg-hover);
}

/* Confirm dialog */
.dialogOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialogBox {
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  max-width: 400px;
  width: 90%;
}

.dialogText {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.5;
  margin-bottom: var(--spacing-md);
}

.dialogActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.dialogBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.dialogBtn.cancel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.dialogBtn.confirm {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

@media (max-width: 768px) {
  .productItem {
    flex-direction: column;
    align-items: flex-start;
  }
  .productActions {
    align-self: flex-end;
  }
  .actionBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
