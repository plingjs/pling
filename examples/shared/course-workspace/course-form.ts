import type { Locale } from "./copy";

export interface CourseFormTeacher {
  id: string;
  name: string;
  subject: string;
}

export interface CourseDraft {
  name: string;
  teacherId: string;
  teacherName: string;
  cards: string;
  difficulty: number;
  intro: string;
  note: string;
  cover: boolean;
  coverUrl: string;
  deduct: string;
  price: string;
}

export interface CourseFormHandlers {
  onSave?: () => void;
  onClose?: () => void;
}

export interface CourseFormController {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  read(): CourseDraft;
  apply(patch: Partial<CourseDraft>, options?: { focus?: boolean }): void;
  reset(): void;
  focus(field: string | readonly string[]): void;
  flash(field: string | readonly string[]): void;
  focusSave(): void;
  setHandlers(handlers: CourseFormHandlers): void;
  subscribe(listener: (draft: CourseDraft) => void): () => void;
  destroy(): void;
}

export interface CourseFormOptions {
  locale: Locale;
  teachers: readonly CourseFormTeacher[];
  onSave?: () => void;
  onClose?: () => void;
}

const CARD_OPTIONS = {
  zh: ["月卡", "私教 10 次卡", "单次体验卡"],
  en: ["Monthly card", "10-class personal training", "Single-class trial"],
} as const;

const TEXT = {
  zh: {
    title: "创建新课程",
    subtitle: "页面保持原样，助手只负责带入信息和提示下一步。",
    sectionInfo: "课程信息",
    sectionInfoHint: "所填内容将展示在学员端",
    name: "课程名称",
    required: "必填",
    difficulty: "请标注难度",
    teacher: "选择授课老师",
    teacherPlaceholder: "选择授课老师",
    tag: "课程标签",
    tagValue: "不分类",
    cards: "课程可用卡片",
    cardsPlaceholder: "选择可以约本课的卡片",
    intro: "课程介绍",
    introPlaceholder: "不超过 200 个字",
    note: "约课须知",
    notePlaceholder: "不超过 200 个字",
    cover: "课程封面",
    upload: "上传图片",
    uploaded: "已选择封面",
    sectionTemplate: "排课模板",
    sectionTemplateHint: "填写后，排课时将默认使用该设置。修改仅对之后创建的课生效。",
    deduct: "每节课扣卡次数",
    deductUnit: "次",
    price: "每节课扣卡金额",
    priceUnit: "元",
    pricePlaceholder: "课时价…",
    cancel: "取消",
    save: "保存",
    saving: "保存中…",
    close: "关闭",
    chooseFile: "选择一张课程封面",
    guided: "助手正在填写",
    pointed: "助手正在定位",
    count: "/ 200",
  },
  en: {
    title: "Create a course",
    subtitle: "The page stays as it is. The assistant fills in values and points to the next step.",
    sectionInfo: "Course information",
    sectionInfoHint: "This appears in the student app",
    name: "Course name",
    required: "Required",
    difficulty: "Difficulty",
    teacher: "Teacher",
    teacherPlaceholder: "Choose a teacher",
    tag: "Category",
    tagValue: "Uncategorised",
    cards: "Eligible cards",
    cardsPlaceholder: "Choose the cards that can book this course",
    intro: "Course introduction",
    introPlaceholder: "Up to 200 characters",
    note: "Booking notes",
    notePlaceholder: "Up to 200 characters",
    cover: "Course cover",
    upload: "Upload image",
    uploaded: "Cover selected",
    sectionTemplate: "Scheduling defaults",
    sectionTemplateHint: "These values become the default when scheduling. Later changes only affect new lessons.",
    deduct: "Classes deducted per booking",
    deductUnit: "class",
    price: "Price per class",
    priceUnit: "CNY",
    pricePlaceholder: "Price…",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    close: "Close",
    chooseFile: "Choose a course cover",
    guided: "Assistant is filling this in",
    pointed: "Assistant is pointing here",
    count: "/ 200",
  },
} as const;

export function createCourseForm(options: CourseFormOptions): CourseFormController {
  const text = TEXT[options.locale];
  const cardOptions = CARD_OPTIONS[options.locale];
  const listeners = new Set<(draft: CourseDraft) => void>();
  let handlers: CourseFormHandlers = {
    ...(options.onSave ? { onSave: options.onSave } : {}),
    ...(options.onClose ? { onClose: options.onClose } : {}),
  };
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;
  let openState = false;

  const element = document.createElement("div");
  element.className = "course-form-layer";
  element.hidden = true;
  element.innerHTML = `
    <div class="course-form-shade"></div>
    <section class="course-modal" role="dialog" aria-modal="true" aria-labelledby="course-modal-title">
      <header class="modal-head">
        <div>
          <h2 id="course-modal-title">${text.title}</h2>
          <p>${text.subtitle}</p>
        </div>
        <button class="modal-close" type="button" aria-label="${text.close}">×</button>
      </header>

      <div class="modal-scroll">
        <section class="form-section">
          <div class="form-section__head">
            <strong>${text.sectionInfo}</strong>
            <span>${text.sectionInfoHint}</span>
          </div>

          <div class="form-grid">
            <label class="field" data-field="name">
              <span class="field-label">${text.name} <em>${text.required}</em></span>
              <input data-input="name" placeholder="${options.locale === "zh" ? "例如：瑜伽基础" : "For example: Yoga foundations"}" />
            </label>

            <div class="field" data-field="difficulty">
              <span class="field-label">${text.difficulty}</span>
              <div class="rating" data-rating aria-label="${text.difficulty}">
                ${[1, 2, 3, 4, 5].map((score) => `<button type="button" data-star="${score}" aria-label="${score}">★</button>`).join("")}
              </div>
            </div>

            <label class="field" data-field="teacher">
              <span class="field-label">${text.teacher}</span>
              <span class="control-shell">
                <select data-input="teacher" aria-label="${text.teacher}">
                  <option value="">${text.teacherPlaceholder}</option>
                  ${options.teachers.map((teacher) => `<option value="${escapeHtml(teacher.id)}">${escapeHtml(teacher.name)}</option>`).join("")}
                </select>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
              </span>
            </label>

            <label class="field">
              <span class="field-label">${text.tag}</span>
              <span class="control-shell">
                <input value="${text.tagValue}" readonly />
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
              </span>
            </label>

            <label class="field" data-field="cards">
              <span class="field-label">${text.cards} <span class="help-dot">?</span></span>
              <span class="control-shell">
                <select data-input="cards" aria-label="${text.cards}">
                  <option value="">${text.cardsPlaceholder}</option>
                  ${cardOptions.map((card) => `<option value="${escapeHtml(card)}">${escapeHtml(card)}</option>`).join("")}
                </select>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
              </span>
            </label>

            <label class="field" data-field="intro">
              <span class="field-label">${text.intro}</span>
              <textarea data-input="intro" placeholder="${text.introPlaceholder}"></textarea>
              <small class="field-count" data-count="intro">0 ${text.count}</small>
            </label>

            <label class="field" data-field="note">
              <span class="field-label">${text.note}</span>
              <textarea data-input="note" placeholder="${text.notePlaceholder}"></textarea>
              <small class="field-count" data-count="note">0 ${text.count}</small>
            </label>

            <div class="field" data-field="cover">
              <span class="field-label">${text.cover}</span>
              <button class="upload-tile" data-upload type="button">
                <span class="upload-icon">＋</span>
                <span class="upload-label">${text.upload}</span>
                <span class="upload-preview" aria-hidden="true"></span>
                <span class="upload-done">${text.uploaded}</span>
              </button>
              <input data-file type="file" accept="image/*" hidden aria-label="${text.chooseFile}" />
            </div>
          </div>
        </section>

        <section class="form-section template-section">
          <div class="form-section__head">
            <strong>${text.sectionTemplate}</strong>
            <span>${text.sectionTemplateHint}</span>
          </div>

          <div class="form-grid template-grid">
            <label class="field" data-field="deduct">
              <span class="field-label">${text.deduct} <span class="help-dot">?</span></span>
              <span class="number-shell"><input data-input="deduct" value="1.0" /><span>${text.deductUnit}</span></span>
            </label>
            <label class="field" data-field="price">
              <span class="field-label">${text.price} <span class="help-dot">?</span></span>
              <span class="number-shell"><input data-input="price" placeholder="${text.pricePlaceholder}" /><span>${text.priceUnit}</span></span>
            </label>
          </div>
        </section>
      </div>

      <footer class="modal-foot">
        <button class="secondary-button" data-cancel type="button">${text.cancel}</button>
        <button class="primary-button save-button" data-save type="button">${text.save}</button>
      </footer>
    </section>
  `;

  const query = <T extends HTMLElement>(selector: string): T => {
    const node = element.querySelector<T>(selector);
    if (!node) throw new Error(`Missing course form node: ${selector}`);
    return node;
  };

  const nameInput = query<HTMLInputElement>('[data-input="name"]');
  const teacherSelect = query<HTMLSelectElement>('[data-input="teacher"]');
  const cardsSelect = query<HTMLSelectElement>('[data-input="cards"]');
  const introInput = query<HTMLTextAreaElement>('[data-input="intro"]');
  const noteInput = query<HTMLTextAreaElement>('[data-input="note"]');
  const deductInput = query<HTMLInputElement>('[data-input="deduct"]');
  const priceInput = query<HTMLInputElement>('[data-input="price"]');
  const uploadTile = query<HTMLButtonElement>("[data-upload]");
  const fileInput = query<HTMLInputElement>("[data-file]");
  const saveButton = query<HTMLButtonElement>("[data-save]");
  const rating = query<HTMLElement>("[data-rating]");
  const coverPreview = query<HTMLElement>(".upload-preview");
  let coverUrl = "";
  let difficulty = 0;

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function draft(): CourseDraft {
    const teacher = options.teachers.find((item) => item.id === teacherSelect.value);
    return {
      name: nameInput.value,
      teacherId: teacherSelect.value,
      teacherName: teacher?.name ?? "",
      cards: cardsSelect.value,
      difficulty,
      intro: introInput.value,
      note: noteInput.value,
      cover: uploadTile.classList.contains("is-uploaded"),
      coverUrl,
      deduct: deductInput.value,
      price: priceInput.value,
    };
  }

  function emit(): void {
    const snapshot = draft();
    for (const listener of listeners) listener(snapshot);
  }

  function updateCount(textarea: HTMLTextAreaElement): void {
    const counter = element.querySelector<HTMLElement>(`[data-count="${textarea.dataset.input}"]`);
    if (counter) counter.textContent = `${textarea.value.length} ${text.count}`;
  }

  function setStar(next: number): void {
    difficulty = next;
    rating.querySelectorAll<HTMLButtonElement>("[data-star]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.star) <= next);
    });
  }

  function markFilled(): void {
    const snapshot = draft();
    element.querySelectorAll<HTMLElement>("[data-field]").forEach((field) => {
      const key = field.dataset.field;
      const filled =
        key === "name" ? Boolean(snapshot.name.trim())
          : key === "difficulty" ? snapshot.difficulty > 0
            : key === "teacher" ? Boolean(snapshot.teacherId)
              : key === "cards" ? Boolean(snapshot.cards.trim())
                : key === "intro" ? Boolean(snapshot.intro.trim())
                  : key === "note" ? Boolean(snapshot.note.trim())
                    : key === "cover" ? snapshot.cover
                      : key === "deduct" ? Boolean(snapshot.deduct.trim())
                        : key === "price" ? Boolean(snapshot.price.trim())
                          : false;
      field.classList.toggle("is-filled", filled);
    });
  }

  function update(): void {
    markFilled();
    updateCount(introInput);
    updateCount(noteInput);
    emit();
  }

  function setUploaded(url: string, notify = true): void {
    coverUrl = url;
    uploadTile.classList.add("is-uploaded");
    coverPreview.style.backgroundImage = url
      ? `linear-gradient(145deg, rgb(21 38 58 / 10%), rgb(21 38 58 / 24%)), url("${url.replaceAll('"', '\\"')}")`
      : "";
    if (notify) update();
  }

  function open(): void {
    element.hidden = false;
    openState = true;
  }

  function close(): void {
    element.hidden = true;
    openState = false;
    handlers.onClose?.();
  }

  function apply(patch: Partial<CourseDraft>, applyOptions: { focus?: boolean } = {}): void {
    if (typeof patch.name === "string") nameInput.value = patch.name;
    if (typeof patch.intro === "string") introInput.value = patch.intro;
    if (typeof patch.note === "string") noteInput.value = patch.note;
    if (typeof patch.deduct === "string") deductInput.value = patch.deduct;
    if (typeof patch.price === "string") priceInput.value = patch.price;
    if (typeof patch.cards === "string") cardsSelect.value = patch.cards;
    if (typeof patch.teacherId === "string") teacherSelect.value = patch.teacherId;
    if (typeof patch.difficulty === "number") setStar(patch.difficulty);
    if (patch.cover === true && !uploadTile.classList.contains("is-uploaded")) setUploaded("", false);
    update();
    if (applyOptions.focus) {
      const fields = Object.keys(patch).filter((key) => key !== "cover" && key !== "coverUrl");
      if (fields.length) focus(fields);
      else if (patch.cover) focus("cover");
    }
  }

  function reset(): void {
    nameInput.value = "";
    teacherSelect.value = "";
    cardsSelect.value = "";
    introInput.value = "";
    noteInput.value = "";
    deductInput.value = "1.0";
    priceInput.value = "";
    coverUrl = "";
    uploadTile.classList.remove("is-uploaded");
    coverPreview.style.backgroundImage = "";
    setStar(0);
    markFilled();
    updateCount(introInput);
    updateCount(noteInput);
    emit();
  }

  function focus(field: string | readonly string[]): void {
    if (highlightTimer) clearTimeout(highlightTimer);
    const names = typeof field === "string" ? [field] : [...field];
    const nodes = names
      .map((name) => element.querySelector<HTMLElement>(`[data-field="${name}"]`))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;
    nodes.forEach((node) => {
      node.classList.add("is-pointed");
      node.dataset.label = text.pointed;
    });
    nodes[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightTimer = setTimeout(() => {
      nodes.forEach((node) => {
        node.classList.remove("is-pointed");
        delete node.dataset.label;
      });
    }, 1800);
  }

  function flash(field: string | readonly string[]): void {
    if (highlightTimer) clearTimeout(highlightTimer);
    const names = typeof field === "string" ? [field] : [...field];
    const nodes = names
      .map((name) => element.querySelector<HTMLElement>(`[data-field="${name}"]`))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;
    nodes.forEach((node) => {
      node.classList.add("is-guided");
      node.dataset.label = text.guided;
    });
    nodes[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightTimer = setTimeout(() => {
      nodes.forEach((node) => {
        node.classList.remove("is-guided");
        delete node.dataset.label;
      });
    }, 1600);
  }

  function focusSave(): void {
    saveButton.classList.add("is-guided");
    saveButton.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => saveButton.classList.remove("is-guided"), 1800);
  }

  rating.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-star]");
    if (!button) return;
    setStar(Number(button.dataset.star));
    update();
  });

  for (const input of [nameInput, teacherSelect, cardsSelect, introInput, noteInput, deductInput, priceInput]) {
    input.addEventListener("input", update);
    input.addEventListener("change", update);
  }

  uploadTile.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    setUploaded(URL.createObjectURL(file));
  });

  query<HTMLButtonElement>(".modal-close").addEventListener("click", close);
  query<HTMLButtonElement>("[data-cancel]").addEventListener("click", close);
  saveButton.addEventListener("click", () => handlers.onSave?.());
  element.querySelector(".course-form-shade")?.addEventListener("click", close);

  return {
    element,
    open,
    close,
    isOpen: () => openState,
    read: draft,
    apply,
    reset,
    focus,
    flash,
    focusSave,
    setHandlers(next) {
      handlers = next;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
      listeners.clear();
      element.remove();
    },
  };
}
