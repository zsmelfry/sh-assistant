<template>
  <BaseModal :open="open" title="导入词汇 (CSV)" max-width="520px" @close="handleClose">
    <!-- Step 1: 选择文件 -->
    <div v-if="step === 1" class="step">
      <p class="stepHint">
        请选择 CSV 文件，格式要求：包含 <code>rank</code> 和 <code>french_word</code> 列。
      </p>
      <input
        ref="fileInput"
        type="file"
        accept=".csv"
        class="fileInput"
        @change="handleFileSelect"
      />
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <!-- Step 2: 预览 -->
    <div v-if="step === 2" class="step">
      <p class="stepHint">
        已解析 <strong>{{ previewCount }}</strong> 行数据，以下是前 10 条预览：
      </p>
      <table class="previewTable">
        <thead>
          <tr>
            <th>排名</th>
            <th>词汇</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in previewWords" :key="w.rank">
            <td>{{ w.rank }}</td>
            <td>{{ w.word }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="previewCount > 10" class="moreHint">
        ... 还有 {{ previewCount - 10 }} 条
      </p>
    </div>

    <!-- Step 3: 完成 -->
    <div v-if="step === 3" class="step">
      <p class="successMsg">
        导入成功！共导入 <strong>{{ importedCount }}</strong> 个词汇。
      </p>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="handleClose">
        {{ step === 3 ? '关闭' : '取消' }}
      </BaseButton>
      <BaseButton
        v-if="step === 2"
        :disabled="importing"
        @click="handleImport"
      >
        {{ importing ? '导入中...' : '确认导入' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const store = useVocabStore();

const step = ref(1);
const rawCsv = ref('');
const previewWords = ref<Array<{ rank: number; word: string }>>([]);
const previewCount = ref(0);
const importing = ref(false);
const importedCount = ref(0);
const error = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  error.value = '';
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result as string;
      rawCsv.value = text;

      // 客户端预览解析
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        error.value = 'CSV 至少需要 header 行和一行数据。';
        return;
      }

      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rankIdx = header.indexOf('rank');
      const wordIdx = header.indexOf('french_word');

      if (rankIdx === -1 || wordIdx === -1) {
        error.value = 'CSV 需要包含 "rank" 和 "french_word" 列。';
        return;
      }

      const words: Array<{ rank: number; word: string }> = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const rank = parseInt(cols[rankIdx], 10);
        const word = cols[wordIdx];
        if (isNaN(rank) || !word) continue;
        words.push({ rank, word });
      }

      if (words.length === 0) {
        error.value = '未能从 CSV 中解析出有效词汇，请检查文件格式。';
        return;
      }

      previewCount.value = words.length;
      previewWords.value = words.slice(0, 10);
      step.value = 2;
    } catch {
      error.value = '文件读取失败，请重试。';
    }
  };
  reader.readAsText(file);
}

async function handleImport() {
  if (importing.value) return;
  importing.value = true;
  try {
    const result = await store.importWords(rawCsv.value);
    importedCount.value = result.imported;
    step.value = 3;
  } catch {
    error.value = '导入失败，请重试。';
    step.value = 1;
  } finally {
    importing.value = false;
  }
}

function handleClose() {
  step.value = 1;
  rawCsv.value = '';
  previewWords.value = [];
  previewCount.value = 0;
  error.value = '';
  importedCount.value = 0;
  importing.value = false;
  if (fileInput.value) fileInput.value.value = '';
  emit('close');
}
</script>

<style scoped>
.step {
  min-height: 80px;
}

.stepHint {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
  line-height: 1.6;
}

.stepHint code {
  font-size: 12px;
  background-color: var(--color-bg-hover);
  padding: 1px 4px;
  border-radius: 2px;
}

.fileInput {
  font-size: 13px;
  color: var(--color-text-primary);
}

.error {
  margin-top: var(--spacing-sm);
  color: var(--color-danger);
  font-size: 13px;
}

.previewTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.previewTable th {
  text-align: left;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.previewTable td {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.moreHint {
  margin-top: var(--spacing-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.successMsg {
  font-size: 14px;
  color: var(--color-text-primary);
  text-align: center;
  padding: var(--spacing-lg) 0;
}
</style>
