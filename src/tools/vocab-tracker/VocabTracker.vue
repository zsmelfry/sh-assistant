<template>
  <div class="vocabTracker">
    <!-- 词汇本切换（始终显示，不依赖 hasWords） -->
    <WordbookSelector />

    <!-- 初始化错误 -->
    <div v-if="initError" class="emptyState">
      <p class="errorMsg">{{ initError }}</p>
      <button class="primaryBtn" @click="handleReload">刷新页面</button>
    </div>

    <!-- 无词汇状态 -->
    <div v-else-if="!store.hasWords && store.filter === 'all' && !store.searchQuery && activeTab === 'vocab'" class="emptyState">
      <p class="emptyTitle">词库为空</p>
      <p class="emptyHint">请先导入 CSV 词汇文件</p>
      <button class="primaryBtn" @click="showImportModal = true">
        导入 CSV
      </button>
    </div>

    <!-- 主内容（有用户有词汇） -->
    <template v-else>

      <!-- Tab 切换 + 设置 -->
      <div class="tabRow">
        <div class="mainTabs">
          <button
            class="mainTab"
            :class="{ active: activeTab === 'vocab' }"
            @click="activeTab = 'vocab'"
          >
            词汇列表
          </button>
          <button
            class="mainTab"
            :class="{ active: activeTab === 'study' }"
            @click="activeTab = 'study'"
          >
            学习模式
          </button>
          <button
            class="mainTab"
            :class="{ active: activeTab === 'categorize' }"
            @click="activeTab = 'categorize'"
          >
            快速分类
          </button>
        </div>
        <div class="toolbarRight">
          <button
            v-if="canDeleteWordbook"
            class="toolbarIconBtn"
            title="删除词汇本"
            @click="showDeleteModal = true"
          >
            <Trash2 :size="15" :stroke-width="1.5" />
          </button>
          <button class="toolbarBtn" :class="{ active: showSettings }" @click="showSettings = !showSettings">
            设置
          </button>
        </div>
      </div>

      <!-- 设置面板 -->
      <div v-if="showSettings" class="settingsPanel">
        <div class="settingsField">
          <label class="settingsLabel">例句兴趣语境</label>
          <div class="settingsInputRow">
            <input
              v-model="interestContextInput"
              class="settingsInput"
              type="text"
              maxlength="20"
              placeholder="例如：足球、烹饪、音乐、旅行"
            />
            <button
              class="settingsSaveBtn"
              :disabled="isSavingSettings"
              @click="saveInterestContext"
            >
              {{ isSavingSettings ? '保存中...' : '保存' }}
            </button>
          </div>
          <p class="settingsHint">设置后新生成的例句会尝试使用该语境，已有释义需手动刷新</p>
        </div>
      </div>

      <!-- 词汇列表 Tab -->
      <div v-show="activeTab === 'vocab'" class="tabContent">
        <StatsPanel />
        <ProgressChart />
        <VocabList />
      </div>

      <!-- 学习模式 Tab -->
      <div v-show="activeTab === 'study'" class="tabContent">
        <StudyView />
      </div>

      <!-- 快速分类 Tab -->
      <div v-show="activeTab === 'categorize'" class="tabContent">
        <CategorizeView />
      </div>
    </template>

    <!-- 删除词汇本确认模态框 -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modalOverlay" @click.self="showDeleteModal = false">
        <div class="modalCard">
          <h3 class="modalTitle">删除词汇本</h3>
          <div class="deleteWordbookList">
            <div
              v-for="wb in deletableWordbooks"
              :key="wb.id"
              class="deleteWordbookItem"
            >
              <div class="deleteWordbookInfo">
                <span class="deleteWordbookName">{{ wb.name }}</span>
                <span class="deleteWordbookMeta">{{ wb.wordCount }} 个单词</span>
              </div>
              <button
                v-if="confirmDeleteId !== wb.id"
                class="deleteItemBtn"
                @click="confirmDeleteId = wb.id"
              >
                删除
              </button>
              <div v-else class="deleteConfirmGroup">
                <span class="deleteConfirmHint">不可恢复</span>
                <button
                  class="deleteConfirmBtn"
                  :disabled="isDeleting"
                  @click="handleDeleteWordbook(wb.id)"
                >
                  {{ isDeleting ? '删除中...' : '确认删除' }}
                </button>
                <button class="deleteCancelBtn" @click="confirmDeleteId = null">取消</button>
              </div>
            </div>
          </div>
          <div class="modalActions">
            <button class="modalCloseBtn" @click="showDeleteModal = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 模态框 -->
    <ImportModal :open="showImportModal" @close="showImportModal = false" />
  </div>
</template>

<script setup lang="ts">
import StatsPanel from './components/StatsPanel.vue';
import ProgressChart from './components/ProgressChart.vue';
import VocabList from './components/VocabList.vue';
import ImportModal from './components/ImportModal.vue';
import StudyView from './components/StudyView.vue';
import CategorizeView from './components/CategorizeView.vue';
import WordbookSelector from './components/WordbookSelector.vue';
import { Trash2 } from 'lucide-vue-next';

const store = useVocabStore();

const activeTab = ref<'vocab' | 'study' | 'categorize'>('vocab');
const showImportModal = ref(false);
const showSettings = ref(false);
const showDeleteModal = ref(false);
const confirmDeleteId = ref<number | null>(null);
const isDeleting = ref(false);
const initError = ref('');

// Settings state
const interestContextInput = ref('');
const isSavingSettings = ref(false);

// Sync input with store when settings panel opens
watch(showSettings, (val) => {
  if (val) {
    interestContextInput.value = store.interestContext;
  }
});

async function saveInterestContext() {
  isSavingSettings.value = true;
  try {
    await store.updateInterestContext(interestContextInput.value);
  } finally {
    isSavingSettings.value = false;
  }
}

const deletableWordbooks = computed(() =>
  store.wordbooks.filter(wb => !wb.isActive && store.wordbooks.length > 1),
);

const canDeleteWordbook = computed(() =>
  store.multiWordbookEnabled && store.wordbooks.length > 1 && deletableWordbooks.value.length > 0,
);

// Reset confirm state when modal closes
watch(showDeleteModal, (val) => {
  if (!val) {
    confirmDeleteId.value = null;
  }
});

async function handleDeleteWordbook(id: number) {
  isDeleting.value = true;
  try {
    await store.deleteWordbook(id);
    confirmDeleteId.value = null;
    // Close modal if no more deletable wordbooks
    if (deletableWordbooks.value.length === 0) {
      showDeleteModal.value = false;
    }
  } catch {
    // Error handled by store
  } finally {
    isDeleting.value = false;
  }
}

function handleReload() {
  globalThis.location.reload();
}

onMounted(async () => {
  try {
    await store.initialize();
  } catch {
    initError.value = '加载数据失败，请刷新页面重试。';
  }
});
</script>

<style scoped>
.vocabTracker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 900px;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbarRight {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.userInfo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.currentUserName {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.toolbarBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.toolbarBtn:hover {
  background-color: var(--color-bg-hover);
}

.toolbarBtn.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.tabRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.settingsPanel {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
}

.settingsField {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.settingsLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settingsInputRow {
  display: flex;
  gap: var(--spacing-sm);
}

.settingsInput {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.settingsInput:focus {
  border-color: var(--color-accent);
}

.settingsInput::placeholder {
  color: var(--color-text-tertiary);
}

.settingsSaveBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
  white-space: nowrap;
}

.settingsSaveBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.settingsSaveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settingsHint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.mainTabs {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.mainTab {
  padding: var(--spacing-xs) var(--spacing-lg);
  border: none;
  background: var(--color-bg-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.mainTab:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.mainTab.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.mainTab:hover:not(.active) {
  background-color: var(--color-bg-hover);
}

.tabContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl) 0;
  gap: var(--spacing-sm);
}

.emptyTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.emptyHint {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.primaryBtn {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.primaryBtn:hover {
  opacity: 0.85;
}

.errorMsg {
  font-size: 14px;
  color: var(--color-danger);
}

.toolbarIconBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.toolbarIconBtn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

/* Delete modal */
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modalCard {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  width: 90%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.modalTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.deleteWordbookList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.deleteWordbookItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
}

.deleteWordbookInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.deleteWordbookName {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.deleteWordbookMeta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.deleteItemBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.deleteItemBtn:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.deleteConfirmGroup {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.deleteConfirmHint {
  font-size: 11px;
  color: var(--color-danger);
}

.deleteConfirmBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  background-color: var(--color-danger);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
  white-space: nowrap;
}

.deleteConfirmBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.deleteConfirmBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.deleteCancelBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.deleteCancelBtn:hover {
  background-color: var(--color-bg-hover);
}

.modalActions {
  display: flex;
  justify-content: flex-end;
}

.modalCloseBtn {
  padding: var(--spacing-xs) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.modalCloseBtn:hover {
  background-color: var(--color-bg-hover);
}

@media (max-width: 768px) {
  .tabRow {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbarRight {
    display: flex;
    justify-content: flex-end;
  }
  .mainTabs {
    display: flex;
    width: 100%;
  }
  .mainTab {
    flex: 1;
    min-height: var(--touch-target-min);
    padding: var(--spacing-sm);
    font-size: 13px;
  }
  .toolbarBtn {
    min-height: var(--touch-target-min);
  }
  .toolbarIconBtn {
    min-height: var(--touch-target-min);
    min-width: var(--touch-target-min);
  }
  .primaryBtn {
    min-height: var(--touch-target-min);
    width: 100%;
  }
  .settingsInputRow {
    flex-direction: column;
  }
  .settingsSaveBtn {
    min-height: var(--touch-target-min);
  }
  .deleteConfirmGroup {
    flex-wrap: wrap;
  }
}
</style>
