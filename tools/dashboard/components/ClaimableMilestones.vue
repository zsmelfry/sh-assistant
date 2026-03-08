<template>
  <div v-if="milestones.length > 0" class="claimable">
    <h3 class="sectionTitle">可领取的里程碑</h3>
    <div class="milestoneList">
      <div
        v-for="m in milestones"
        :key="m.milestoneId"
        class="milestoneCard"
      >
        <div class="milestoneInfo">
          <span class="milestoneName">{{ m.title }}</span>
          <span class="milestoneSkill">{{ m.categoryName }} / {{ m.skillName }} · T{{ m.tier }}</span>
          <span class="milestoneDetail">{{ m.detail }}</span>
        </div>
        <button
          class="claimBtn"
          :disabled="claiming === m.milestoneId"
          @click="handleClaim(m)"
        >
          {{ claiming === m.milestoneId ? '领取中...' : '领取' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ClaimableMilestone {
  milestoneId: number;
  title: string;
  tier: number;
  skillId: number;
  skillName: string;
  categoryName: string;
  currentValue: number;
  threshold: number;
  detail: string;
}

const milestones = ref<ClaimableMilestone[]>([]);
const claiming = ref<number | null>(null);

onMounted(async () => {
  try {
    milestones.value = await $fetch<ClaimableMilestone[]>('/api/ability-skills/claimable-milestones');
  } catch {
    // silently fail
  }
});

async function handleClaim(m: ClaimableMilestone) {
  claiming.value = m.milestoneId;
  try {
    await $fetch(`/api/ability-skills/${m.skillId}/milestones/${m.milestoneId}/complete`, {
      method: 'POST',
      body: {
        verifyMethod: 'platform_auto',
        evidenceNote: m.detail,
      },
    });
    // Remove from list
    milestones.value = milestones.value.filter(x => x.milestoneId !== m.milestoneId);
  } catch (e: unknown) {
    alert(extractErrorMessage(e, '领取失败'));
  } finally {
    claiming.value = null;
  }
}
</script>

<style scoped>
.claimable {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.milestoneList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.milestoneCard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
}

.milestoneInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.milestoneName {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.milestoneSkill {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.milestoneDetail {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.claimBtn {
  flex-shrink: 0;
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.claimBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.claimBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
