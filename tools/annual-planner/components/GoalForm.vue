<template>
  <BaseModal
    :open="open"
    :title="editGoal ? '编辑目标' : '新建目标'"
    max-width="480px"
    @close="$emit('close')"
  >
    <div class="form">
      <div class="field">
        <label class="label">标题</label>
        <input
          ref="titleRef"
          v-model="title"
          class="input"
          type="text"
          placeholder="输入目标标题..."
        />
      </div>

      <div class="field">
        <label class="label">描述（可选）</label>
        <textarea
          v-model="description"
          class="textarea"
          placeholder="输入目标描述..."
          rows="2"
        />
      </div>

      <div class="field">
        <label class="label">优先级</label>
        <div class="priorityGroup">
          <button
            v-for="p in priorities"
            :key="p.value"
            class="priorityBtn"
            :class="{ active: priority === p.value }"
            @click="priority = p.value"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div v-if="abilitySkills.length > 0" class="field">
        <label class="label">关联能力技能</label>
        <select v-model="linkedAbilitySkillId" class="selectInput">
          <option :value="null">不关联</option>
          <option
            v-for="s in abilitySkills"
            :key="s.id"
            :value="s.id"
          >
            {{ s.categoryName }} / {{ s.name }}
          </option>
        </select>
      </div>

      <div class="field">
        <label class="label">标签</label>
        <div class="tagSelector">
          <button
            v-for="tag in availableTags"
            :key="tag.id"
            class="tagChip"
            :class="{ selected: selectedTagIds.has(tag.id) }"
            @click="toggleTag(tag.id)"
          >
            {{ tag.name }}
          </button>
          <span v-if="availableTags.length === 0" class="noTags">
            暂无标签
          </span>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="$emit('close')">
        取消
      </BaseButton>
      <BaseButton
        :disabled="!title.trim() || submitting"
        @click="handleSubmit"
      >
        {{ editGoal ? '保存' : '创建' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { GoalWithDetails, PlannerTag, Priority } from '../types';
import { PRIORITY_LABELS } from '../types';

const props = withDefaults(defineProps<{
  open: boolean;
  editGoal?: GoalWithDetails | null;
  availableTags: PlannerTag[];
}>(), {
  editGoal: null,
});

const emit = defineEmits<{
  close: [];
  submit: [data: { title: string; description: string; priority: Priority; tagIds: number[]; linkedAbilitySkillId: number | null }];
}>();

const title = ref('');
const description = ref('');
const priority = ref<Priority>('medium');
const linkedAbilitySkillId = ref<number | null>(null);
const selectedTagIds = ref<Set<number>>(new Set());
const titleRef = ref<HTMLInputElement | null>(null);
const submitting = ref(false);
const abilitySkills = ref<Array<{ id: number; name: string; categoryName: string }>>([]);

onMounted(async () => {
  try {
    const rows = await $fetch<Array<{ id: number; name: string; categoryName: string }>>('/api/ability-skills?status=active');
    abilitySkills.value = rows;
  } catch {
    // Ability module may not have data yet
  }
});

const priorities = [
  { value: 'high' as const, label: PRIORITY_LABELS.high },
  { value: 'medium' as const, label: PRIORITY_LABELS.medium },
  { value: 'low' as const, label: PRIORITY_LABELS.low },
];

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    if (props.editGoal) {
      title.value = props.editGoal.title;
      description.value = props.editGoal.description;
      priority.value = props.editGoal.priority;
      linkedAbilitySkillId.value = props.editGoal.linkedAbilitySkillId ?? null;
      selectedTagIds.value = new Set(props.editGoal.tags.map(t => t.id));
    } else {
      title.value = '';
      description.value = '';
      priority.value = 'medium';
      linkedAbilitySkillId.value = null;
      selectedTagIds.value = new Set();
    }
    nextTick(() => titleRef.value?.focus());
  }
});

function toggleTag(id: number) {
  const next = new Set(selectedTagIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedTagIds.value = next;
}

async function handleSubmit() {
  if (!title.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    emit('submit', {
      title: title.value.trim(),
      description: description.value.trim(),
      priority: priority.value,
      tagIds: Array.from(selectedTagIds.value),
      linkedAbilitySkillId: linkedAbilitySkillId.value,
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.input:focus {
  border-color: var(--color-accent);
}

.textarea {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  outline: none;
  resize: vertical;
  font-family: inherit;
  transition: border-color var(--transition-fast);
}

.textarea:focus {
  border-color: var(--color-accent);
}

.priorityGroup {
  display: flex;
  gap: var(--spacing-sm);
}

.priorityBtn {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.priorityBtn:hover {
  background-color: var(--color-bg-hover);
}

.priorityBtn.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.tagSelector {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.tagChip {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.tagChip:hover {
  background-color: var(--color-bg-hover);
}

.tagChip.selected {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.noTags {
  font-size: 13px;
  color: var(--color-text-disabled);
}

.selectInput {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  outline: none;
}

.selectInput:focus {
  border-color: var(--color-accent);
}
</style>
