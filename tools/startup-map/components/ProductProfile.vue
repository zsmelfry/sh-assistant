<template>
  <div class="productProfile">
    <!-- Loading -->
    <div v-if="store.productLoading" class="loadingState">
      加载中...
    </div>

    <template v-else>
      <h2 class="pageTitle">产品档案</h2>
      <p class="pageDesc">
        填写你的产品信息，AI 将根据这些背景生成更有针对性的教学内容和建议
      </p>

      <form class="profileForm" @submit.prevent="handleSave">
        <div class="formGroup">
          <label class="formLabel" for="productName">产品名称 *</label>
          <input
            id="productName"
            v-model="form.name"
            class="formInput"
            type="text"
            placeholder="如：老年男士防漏尿内裤"
            required
          />
        </div>

        <div class="formGroup">
          <label class="formLabel" for="productDesc">产品描述</label>
          <textarea
            id="productDesc"
            v-model="form.description"
            class="formTextarea"
            rows="3"
            placeholder="产品是什么、解决什么问题"
          />
        </div>

        <div class="formGroup">
          <label class="formLabel" for="targetMarket">目标市场</label>
          <input
            id="targetMarket"
            v-model="form.targetMarket"
            class="formInput"
            type="text"
            placeholder="如：法国，后续扩展至欧洲"
          />
        </div>

        <div class="formGroup">
          <label class="formLabel" for="targetCustomer">目标客户</label>
          <textarea
            id="targetCustomer"
            v-model="form.targetCustomer"
            class="formTextarea"
            rows="2"
            placeholder="如：60岁以上有轻度失禁问题的男性，及其子女"
          />
        </div>

        <div class="formGroup">
          <label class="formLabel" for="productionSource">生产来源</label>
          <input
            id="productionSource"
            v-model="form.productionSource"
            class="formInput"
            type="text"
            placeholder="如：中国工厂生产，出口至法国"
          />
        </div>

        <div class="formGroup">
          <label class="formLabel" for="currentStage">当前阶段</label>
          <select
            id="currentStage"
            v-model="form.currentStage"
            class="formSelect"
          >
            <option
              v-for="(label, value) in PRODUCT_STAGE_LABELS"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select>
        </div>

        <div class="formGroup">
          <label class="formLabel" for="productNotes">补充说明</label>
          <textarea
            id="productNotes"
            v-model="form.notes"
            class="formTextarea"
            rows="3"
            placeholder="其他 AI 需要知道的背景信息"
          />
        </div>

        <div class="formActions">
          <button
            type="submit"
            class="saveBtn"
            :disabled="!form.name.trim() || store.productSaving"
          >
            {{ store.productSaving ? '保存中...' : (isEditing ? '保存' : '创建产品') }}
          </button>
          <span v-if="saved" class="savedHint">已保存</span>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PRODUCT_STAGE_LABELS } from '../types';
import type { ProductStage, ProductFormData } from '../types';

const store = useStartupMapStore();

const isEditing = computed(() => !!store.activeProduct);
const saved = ref(false);
let savedTimer: ReturnType<typeof setTimeout> | null = null;

const form = reactive<ProductFormData>({
  name: '',
  description: '',
  targetMarket: '',
  targetCustomer: '',
  productionSource: '',
  currentStage: 'ideation' as ProductStage,
  notes: '',
});

// Sync form with active product
watch(() => store.activeProduct, (product) => {
  if (product) {
    form.name = product.name;
    form.description = product.description || '';
    form.targetMarket = product.targetMarket || '';
    form.targetCustomer = product.targetCustomer || '';
    form.productionSource = product.productionSource || '';
    form.currentStage = product.currentStage;
    form.notes = product.notes || '';
  }
}, { immediate: true });

onMounted(() => {
  store.loadActiveProduct();
});

async function handleSave() {
  if (!form.name.trim()) return;
  saved.value = false;

  if (store.activeProduct) {
    await store.updateProduct(store.activeProduct.id, { ...form });
  } else {
    await store.createProduct({ ...form });
  }

  saved.value = true;
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { saved.value = false; }, 3000);
}

onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer);
});
</script>

<style scoped>
.productProfile {
  max-width: 600px;
}

.loadingState {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: 14px;
}

.pageTitle {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.pageDesc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
  line-height: 1.5;
}

/* Form */
.profileForm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.formGroup {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.formLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.formInput,
.formTextarea,
.formSelect {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.formInput:focus,
.formTextarea:focus,
.formSelect:focus {
  border-color: var(--color-accent);
}

.formInput::placeholder,
.formTextarea::placeholder {
  color: var(--color-text-disabled);
}

.formTextarea {
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}

.formSelect {
  cursor: pointer;
}

/* Actions */
.formActions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding-top: var(--spacing-sm);
}

.saveBtn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.saveBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.saveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.savedHint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .saveBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
