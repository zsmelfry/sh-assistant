<template>
  <div class="vocabList">
    <FilterBar />

    <div v-if="store.isLoading" class="loading">
      加载中...
    </div>

    <div v-else-if="store.words.length === 0" class="empty">
      {{ store.searchQuery ? '没有找到匹配的词汇' : '暂无词汇数据' }}
    </div>

    <template v-else>
      <div class="wordList">
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
}

.wordList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.loading,
.empty {
  text-align: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}
</style>
