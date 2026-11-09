<script setup lang="ts">
import CourseCreatePage from "../../../shared/course-create/CourseCreatePage.vue";
import type { Locale } from "../../../shared/course-workspace/copy";

defineProps<{ locale: Locale }>();
</script>

<template>
  <CourseCreatePage :locale="locale" task-placement="none" />
</template>
