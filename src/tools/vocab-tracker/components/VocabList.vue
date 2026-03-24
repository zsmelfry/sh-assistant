<template>
  <div class="vocabList">
    <FilterBar />

    <div v-if="store.isLoading && store.words.length === 0" class="loading">
      加载中...
    </div>

    <div v-else-if="!store.isLoading && store.words.length === 0" class="empty">
      {{ store.searchQuery ? '没有找到匹配的词汇' : '暂无词汇数据' }}
    </div>

    <template v-else>
      <div class="wordList" :class="{ loading: store.isLoading }">
        <VocabItem
          v-for="word in store.words"
          :key="word.id"
          :word="word"
        />
      </div>

      <BatchActionBar />
      <Pagination />
    </template>
  </div>
</template>

<script setup lang="ts">
import FilterBar from './FilterBar.vue';
import VocabItem from './VocabItem.vue';
import BatchActionBar from './BatchActionBar.vue';
import Pagination from './Pagination.vue';

const store = useVocabStore();
</script>

<style scoped>
.vocabList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-height: 200px;
}

.wordList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.empty {
  text-align: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.wordList.loading {
  opacity: 0.5;
  pointer-events: none;
}
</style>
