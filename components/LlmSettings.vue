<template>
  <BaseModal :open="open" title="LLM 模型设置" max-width="560px" @close="$emit('close')">
    <!-- 默认模型指示 -->
    <div class="defaultInfo">
      <span class="defaultLabel">默认模型</span>
      <span class="defaultName">{{ defaultProvider?.name || '未设置' }}</span>
    </div>

    <!-- 操作栏 -->
    <div class="actionBar">
      <button class="actionBtn" :disabled="isSyncing" @click="handleDiscover">
        <RefreshCw :size="14" :stroke-width="1.5" :class="{ spinning: isSyncing }" />
        {{ isSyncing ? '发现中...' : '发现模型' }}
      </button>
      <button class="actionBtn" @click="showAddForm = !showAddForm">
        <Plus :size="14" :stroke-width="1.5" />
        添加
      </button>
    </div>

    <!-- 添加表单 -->
    <div v-if="showAddForm" class="addForm">
      <div class="formRow">
        <label class="formLabel">类型</label>
        <select v-model="newProvider.provider" class="formInput">
          <option value="claude">Claude (CLI)</option>
          <option value="claude-api">Claude (API)</option>
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      <div class="formRow">
        <label class="formLabel">名称</label>
        <input v-model="newProvider.name" class="formInput" placeholder="显示名称" />
      </div>
      <div class="formRow">
        <label class="formLabel">模型</label>
        <input v-model="newProvider.modelName" class="formInput" placeholder="模型标识" />
      </div>
      <div v-if="newProvider.provider === 'ollama' || newProvider.provider === 'openai'" class="formRow">
        <label class="formLabel">端点</label>
        <input v-model="newProvider.endpoint" class="formInput" placeholder="http://localhost:11434" />
      </div>
      <div v-if="newProvider.provider === 'claude-api' || newProvider.provider === 'openai'" class="formRow">
        <label class="formLabel">API Key</label>
        <input v-model="newProvider.apiKey" class="formInput" type="password" placeholder="sk-ant-..." />
      </div>
      <div class="formActions">
        <button class="cancelBtn" @click="showAddForm = false">取消</button>
        <button class="saveBtn" :disabled="!canSave || isSaving" @click="handleAdd">
          {{ isSaving ? '添加中...' : '添加' }}
        </button>
      </div>
    </div>

    <!-- 发现的模型列表 -->
    <div v-if="discoveredModels.length > 0" class="discoveredSection">
      <p class="sectionTitle">可添加的模型</p>
      <div class="discoveredList">
        <div
          v-for="model in discoveredModels"
          :key="`${model.provider}-${model.modelName}`"
          class="discoveredItem"
        >
          <div class="discoveredInfo">
            <span class="discoveredName">{{ model.displayName }}</span>
            <span class="providerTag">{{ model.provider }}</span>
          </div>
          <button
            class="addModelBtn"
            :disabled="isModelAdded(model)"
            @click="handleAddDiscovered(model)"
          >
            {{ isModelAdded(model) ? '已添加' : '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Provider 列表 -->
    <div class="providerList">
      <div v-if="isLoading" class="loadingState">加载中...</div>
      <div v-else-if="providers.length === 0" class="emptyState">暂无模型配置</div>
      <div
        v-for="p in providers"
        :key="p.id"
        class="providerItem"
        :class="{ isDefault: p.isDefault, isDisabled: !p.isEnabled }"
      >
        <div class="providerMain">
          <div class="providerHeader">
            <span class="providerName">{{ p.name }}</span>
            <span v-if="p.isDefault" class="badge badgeDefault">默认</span>
            <span v-if="!p.isEnabled" class="badge badgeDisabled">已禁用</span>
          </div>
          <div class="providerMeta">
            <span>{{ p.provider }}</span>
            <span class="metaDot">&middot;</span>
            <span>{{ p.modelName }}</span>
            <template v-if="p.endpoint">
              <span class="metaDot">&middot;</span>
              <span class="providerEndpoint">{{ p.endpoint }}</span>
            </template>
          </div>
        </div>
        <div class="providerActions">
          <button
            v-if="!p.isDefault && p.isEnabled"
            class="iconBtn"
            title="设为默认"
            @click="handleSetDefault(p.id)"
          >
            <Star :size="14" :stroke-width="1.5" />
          </button>
          <button
            class="iconBtn"
            :title="p.isEnabled ? '禁用' : '启用'"
            @click="handleToggleEnabled(p)"
          >
            <component :is="p.isEnabled ? EyeOff : Eye" :size="14" :stroke-width="1.5" />
          </button>
          <button
            v-if="!p.isDefault"
            class="iconBtn iconBtnDanger"
            title="删除"
            @click="handleDelete(p)"
          >
            <Trash2 :size="14" :stroke-width="1.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <p v-if="errorMsg" class="errorMsg">{{ errorMsg }}</p>
  </BaseModal>
</template>

<script setup lang="ts">
import { Star, Trash2, Eye, EyeOff, RefreshCw, Plus } from 'lucide-vue-next';
import type { LlmProvider, ModelInfo, CreateProviderRequest } from '~/composables/useLlm';

defineProps<{
  open: boolean;
}>();

defineEmits<{
  close: [];
}>();

const {
  providers,
  defaultProvider,
  loadProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  setDefault,
  discoverModels,
} = useLlm();

const isLoading = ref(true);
const isSyncing = ref(false);
const isSaving = ref(false);
const showAddForm = ref(false);
const errorMsg = ref('');
const discoveredModels = ref<ModelInfo[]>([]);

const newProvider = ref<CreateProviderRequest>({
  provider: 'claude',
  name: '',
  modelName: '',
  endpoint: '',
  apiKey: '',
});

const canSave = computed(() =>
  newProvider.value.name.trim() && newProvider.value.modelName.trim(),
);

onMounted(async () => {
  try {
    await loadProviders();
  } finally {
    isLoading.value = false;
  }
});

function isModelAdded(model: ModelInfo): boolean {
  return providers.value.some(
    p => p.provider === model.provider && p.modelName === model.modelName,
  );
}

async function handleDiscover() {
  isSyncing.value = true;
  errorMsg.value = '';
  try {
    const models = await discoverModels();
    discoveredModels.value = models.filter(m => !isModelAdded(m));
    if (discoveredModels.value.length === 0) {
      errorMsg.value = '没有发现新模型';
      setTimeout(() => { errorMsg.value = ''; }, 2000);
    }
  } catch {
    errorMsg.value = '模型发现失败，请检查 Ollama 是否运行';
  } finally {
    isSyncing.value = false;
  }
}

async function handleAdd() {
  isSaving.value = true;
  errorMsg.value = '';
  try {
    const data: CreateProviderRequest = {
      provider: newProvider.value.provider,
      name: newProvider.value.name.trim(),
      modelName: newProvider.value.modelName.trim(),
    };
    if (newProvider.value.endpoint?.trim()) {
      data.endpoint = newProvider.value.endpoint.trim();
    }
    if (newProvider.value.apiKey?.trim()) {
      data.apiKey = newProvider.value.apiKey.trim();
    }
    await addProvider(data);
    showAddForm.value = false;
    newProvider.value = { provider: 'claude', name: '', modelName: '', endpoint: '', apiKey: '' };
  } catch {
    errorMsg.value = '添加失败';
  } finally {
    isSaving.value = false;
  }
}

async function handleAddDiscovered(model: ModelInfo) {
  errorMsg.value = '';
  try {
    await addProvider({
      provider: model.provider as CreateProviderRequest['provider'],
      name: model.displayName,
      modelName: model.modelName,
      endpoint: model.provider === 'ollama' ? 'http://localhost:11434' : undefined,
    });
    discoveredModels.value = discoveredModels.value.filter(
      m => !(m.provider === model.provider && m.modelName === model.modelName),
    );
  } catch {
    errorMsg.value = '添加模型失败';
  }
}

async function handleSetDefault(id: number) {
  errorMsg.value = '';
  try {
    await setDefault(id);
  } catch {
    errorMsg.value = '设置默认失败';
  }
}

async function handleToggleEnabled(p: LlmProvider) {
  errorMsg.value = '';
  try {
    await updateProvider(p.id, { isEnabled: !p.isEnabled });
  } catch {
    errorMsg.value = '操作失败';
  }
}

async function handleDelete(p: LlmProvider) {
  errorMsg.value = '';
  try {
    await deleteProvider(p.id);
  } catch {
    errorMsg.value = '删除失败，默认模型不能删除';
  }
}
</script>

<style scoped>
.defaultInfo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);
}

.defaultLabel {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.defaultName {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.actionBar {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.actionBtn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.actionBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.actionBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 添加表单 */
.addForm {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.formRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.formLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
  width: 50px;
  flex-shrink: 0;
}

.formInput {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.formInput:focus {
  outline: none;
  border-color: var(--color-accent);
}

.formActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.cancelBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.cancelBtn:hover {
  background-color: var(--color-bg-hover);
}

.saveBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.saveBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.saveBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 发现的模型 */
.discoveredSection {
  margin-bottom: var(--spacing-md);
}

.sectionTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.discoveredList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.discoveredItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.discoveredInfo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.discoveredName {
  font-size: 13px;
  color: var(--color-text-primary);
}

.providerTag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.addModelBtn {
  padding: 2px var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.addModelBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.addModelBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Provider 列表 */
.providerList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.loadingState,
.emptyState {
  text-align: center;
  padding: var(--spacing-lg) 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.providerItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.providerItem:hover {
  background-color: var(--color-bg-hover);
}

.providerItem.isDefault {
  border-color: var(--color-accent);
}

.providerItem.isDisabled {
  opacity: 0.5;
}

.providerMain {
  flex: 1;
  min-width: 0;
}

.providerHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.providerName {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.badgeDefault {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.badgeDisabled {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.providerMeta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.metaDot {
  color: var(--color-text-disabled);
}

.providerEndpoint {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.providerActions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.iconBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.iconBtn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.iconBtnDanger:hover {
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.errorMsg {
  margin-top: var(--spacing-sm);
  font-size: 13px;
  color: var(--color-danger);
  text-align: center;
}
</style>
