<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { usePling } from "@plingjs/vue";
import CourseCreatePage from "../../../shared/course-create/CourseCreatePage.vue";
import type { Locale } from "../../../shared/course-workspace/copy";
import { courseGoal } from "../../../shared/course-create/task";

const props = defineProps<{ locale: Locale }>();
const pling = usePling();

// The whole task integration. No fields, steps, controller, form surface or
// page callbacks: the goal keeps the outcome alive while the agent operates the
// real create-course button, form controls and save action itself.
const disposeGoal = pling.task.goal(courseGoal(props.locale));

onBeforeUnmount(disposeGoal);
</script>

<template>
  <CourseCreatePage :locale="props.locale" task-placement="inline" />
</template>
