<template>
  <div class="habitTracker">
    <EmptyState
      v-if="!store.habits.length"
      @create="showForm = true"
    />

    <template v-else>
      <HabitList
        :habits="store.habits"
        :selected-id="store.selectedHabitId"
        @select="store.selectHabit($event)"
        @new="openNewForm"
        @edit="openEditForm"
        @delete="openDeleteConfirm"
      />

      <div v-if="store.selectedHabit" class="mainContent">
        <StatsBar
          :streak="store.streak"
          :monthly-rate="store.monthlyRate"
          :frequency="store.selectedFrequency"
        />

        <CalendarNav
          :month="store.currentMonth"
          @prev="prevMonth"
          @next="nextMonth"
        />

        <Calendar
          :month="store.currentMonth"
          :frequency="store.selectedFrequency"
          :check-ins="store.checkIns"
          :all-check-in-dates="store.allCheckInDates"
          @toggle="store.toggleCheckIn($event)"
        />

        <HistoryPanel
          :habit-id="store.selectedHabitId!"
          :frequency="store.selectedFrequency"
        />
      </div>
    </template>

    <!-- 创建/编辑表单 -->
    <HabitForm
      :open="showForm"
      :edit-habit="editingHabit"
      @close="closeForm"
      @submit="handleFormSubmit"
    />

    <!-- 删除确认 -->
    <ConfirmDialog
      :open="!!deletingHabit"
      title="删除习惯"
      :message="`确定要删除「${deletingHabit?.name}」吗？所有打卡记录也将被删除。`"
      confirm-text="删除"
      :danger="true"
      @confirm="handleDelete"
      @cancel="deletingHabit = null"
    />
  </div>
</template>

<script setup lang="ts">
import { format, subMonths, addMonths } from 'date-fns';
import type { Habit, HabitFrequency, YearMonth } from './types';

// 使用 局部导入 避免 Nuxt 自动导入冲突（tools/ 不在 components/ 下）
import EmptyState from './components/EmptyState.vue';
import HabitList from './components/HabitList.vue';
import HabitForm from './components/HabitForm.vue';
import StatsBar from './components/StatsBar.vue';
import CalendarNav from './components/CalendarNav.vue';
import Calendar from './components/Calendar.vue';
import HistoryPanel from './components/HistoryPanel.vue';

const store = useHabitStore();

// 表单状态
const showForm = ref(false);
const editingHabit = ref<Habit | null>(null);
const deletingHabit = ref<Habit | null>(null);

// 初始化
onMounted(async () => {
  await store.loadHabits();
  if (store.habits.length > 0 && !store.selectedHabitId) {
    await store.selectHabit(store.habits[0].id);
  }
});

// 月份导航
function prevMonth() {
  const [year, month] = store.currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  store.setMonth(format(subMonths(date, 1), 'yyyy-MM'));
}

function nextMonth() {
  const [year, month] = store.currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  store.setMonth(format(addMonths(date, 1), 'yyyy-MM'));
}

// 表单操作
function openNewForm() {
  editingHabit.value = null;
  showForm.value = true;
}

function openEditForm(habit: Habit) {
  editingHabit.value = habit;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingHabit.value = null;
}

async function handleFormSubmit(data: { name: string; frequency: HabitFrequency }) {
  if (editingHabit.value) {
    await store.updateHabit(editingHabit.value.id, data);
  } else {
    await store.createHabit(data.name, data.frequency);
  }
  closeForm();
}

// 删除操作
function openDeleteConfirm(habit: Habit) {
  deletingHabit.value = habit;
}

async function handleDelete() {
  if (!deletingHabit.value) return;
  await store.deleteHabit(deletingHabit.value.id);
  deletingHabit.value = null;
}
</script>

<style scoped>
.habitTracker {
  display: flex;
  height: 100%;
  min-height: 500px;
}

.mainContent {
  flex: 1;
  padding: 0 var(--spacing-lg);
  overflow-y: auto;
}
</style>
