import type { Locale } from "../course-workspace/copy";
import type { CourseDraft, CourseTeacher, RecommendedCourse } from "./model";

/**
 * Legacy deterministic natural-language intake.
 *
 * Kept as a historical reference for the pre-agent-first course demo. New
 * integrations should let the model use the active task's working memory and
 * the narrow task tools instead of maintaining an intent grammar here.
 */

/** Fields the demo can understand from one natural-language instruction. */
export type CourseIntakeField =
  | "name"
  | "teacher"
  | "cards"
  | "difficulty"
  | "intro"
  | "note"
  | "deduct"
  | "price";

export interface CourseIntakePatch {
  name?: string;
  teacherId?: string;
  teacherName?: string;
  cards?: string;
  difficulty?: number;
  intro?: string;
  note?: string;
  deduct?: string;
  price?: string;
}

export interface CourseIntakeResult {
  patch: CourseIntakePatch;
  recognized: CourseIntakeField[];
  wantsCreate: boolean;
  wantsReview: boolean;
  wantsSave: boolean;
  wantsCancel: boolean;
  wantsStatus: boolean;
  /** The user is asking what the assistant can do or what to do next. */
  wantsHelp: boolean;
  /** The message is a question rather than a value for the current field. */
  question: boolean;
  /**
   * The person delegated the choice to the assistant, for example
   * “你来帮我随便填” or “看着办”. This is an intent, not a field value.
   */
  autofill: boolean;
  correction: boolean;
  autoIntro: boolean;
  unknownTeacher?: string;
  ambiguousTeachers?: string[];
  invalidDifficulty?: number;
}

export interface CourseIntakeParseOptions {
  locale: Locale;
  teachers: readonly CourseTeacher[];
  recommended: RecommendedCourse;
  cardOptions: readonly string[];
  /**
   * The field the page is currently inviting the user to answer. This is only
   * used to allow a short standalone answer such as “孕妇瑜伽” while the
   * assistant has explicitly asked for the course name. It must never turn an
   * arbitrary sentence into a field value.
   */
  expects?: CourseIntakeField;
}

export interface CourseIntakeReplyOptions extends CourseIntakeParseOptions {
  draft: CourseDraft;
  result: CourseIntakeResult;
}

const FIELD_LABELS: Record<Locale, Record<CourseIntakeField, string>> = {
  zh: {
    name: "课程名称",
    teacher: "授课老师",
    cards: "可用卡",
    difficulty: "难度",
    intro: "课程介绍",
    note: "约课须知",
    deduct: "扣卡次数",
    price: "单节金额",
  },
  en: {
    name: "Course name",
    teacher: "Teacher",
    cards: "Eligible cards",
    difficulty: "Difficulty",
    intro: "Course introduction",
    note: "Booking notes",
    deduct: "Classes deducted",
    price: "Price",
  },
};

const REPLY_COPY = {
  zh: {
    filled: "已填入：{fields}。",
    updated: "已更新：{fields}。",
    unknownTeacher: "没找到「{name}」这位老师，现在可选的是 {options}。",
    ambiguousTeacher: "「{name}」可能指 {options}，你说是哪一位？",
    invalidDifficulty: "难度只能是 1–5 星，{value} 星我没写进去。",
    missingName: "课程名称还没给。",
    missingTeacher: "授课老师还没定，可选 {options}。",
    missingCards: "可用卡还没定，可选 {options}。",
    coverOnly: "其他信息齐了，只剩封面。点「上传封面」选一张图就行。",
    noChange: "这句我没抓到要改哪个字段。可以像这样说：难度改成 3 星。",
    defaults: "没提到的可选项先按页面默认值处理。",
    help:
      "我可以帮你完成这门课程：整理你已经说出的信息、指出真正的缺口、解释当前在做什么、定位页面字段、给出推荐值；封面需要你亲自上传，最后我会核对并保存。",
    helpEmpty:
      "现在还没开始填。你可以直接说「孕妇瑜伽，陈老师，2 星，介绍自动填写」，也可以自己在页面填，我负责补缺和定位。",
    helpProgress: "当前还差：{fields}。",
    helpReady: "必填信息已经齐了。你可以让我核对、上传封面，或者直接保存。",
    helpQuestion: "你也可以直接问某个字段怎么填，或者说“改难度”“用推荐值”“定位老师”。",
  },
  en: {
    filled: "Filled: {fields}.",
    updated: "Updated: {fields}.",
    unknownTeacher: "I could not find “{name}”. Available teachers: {options}.",
    ambiguousTeacher: "“{name}” could mean {options}. Which one do you mean?",
    invalidDifficulty: "Difficulty must be 1–5 stars; I did not write {value}.",
    missingName: "The course name is still missing.",
    missingTeacher: "No teacher is selected yet. Available: {options}.",
    missingCards: "No eligible cards are selected. Available: {options}.",
    coverOnly: "Everything else is ready. Only the cover is left — choose an image in the upload area.",
    noChange: "I did not catch which field to change. Try: set the difficulty to 3 stars.",
    defaults: "Unmentioned optional fields will use the page defaults.",
    help:
      "I can help you finish this course: organise what you have already said, name the real gaps, explain what is happening, point to page fields, and offer recommendations. You choose the cover yourself; then I verify and save.",
    helpEmpty:
      "Nothing has been filled yet. Describe the course in one sentence, for example “pregnancy yoga, Chen, 2 stars, write the intro”, or fill the page yourself and I will close the gaps.",
    helpProgress: "Still missing: {fields}.",
    helpReady: "The required information is ready. You can ask me to review it, upload the cover, or save.",
    helpQuestion: "You can also ask how a field works, say “change the difficulty”, “use the recommendation”, or “locate the teacher”.",
  },
} as const;

const DIFFICULTY_DIGITS: Record<string, number> = {
  "一": 1,
  "二": 2,
  "三": 3,
  "四": 4,
  "五": 5,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
};

const NAME_STOPWORDS = new Set([
  "改成",
  "改为",
  "换成",
  "换为",
  "变成",
  "调整",
  "修改",
  "更新",
  "设置",
  "设为",
  "一下",
  "谢谢",
  "please",
  "thanks",
  "set",
  "change",
  "update",
]);

// These are conversation intents, not course fields. Keep them deliberately
// narrow: a course description such as “介绍什么都行” must not become a
// question just because it contains “什么”.
const HELP_PATTERN =
  /(?:你会做什么|你能做什么|能做什么|可以做什么|能干什么|可以干什么|你会什么|我该做什么|我现在该做什么|下一步(?:做什么|怎么办)?|接下来(?:做什么|怎么办)?|怎么开始|如何开始|怎么用|如何使用|帮帮我|what can you do|what should i do|how do i (?:start|use)|how can i (?:start|use)|help me)/i;
const QUESTION_PATTERN =
  /(?:[?？]|(?:^|[，,。.!！\s])(?:什么|怎么|如何|为什么|哪个|哪些|哪里|能不能|可不可以|可以吗|是否|多少|多久|会不会|有没有)|(?:做什么|干什么|能做什么|能干什么|你会|你能|我该|我们该|要怎么做|下一步|接下来)|(?:吗|呢)\s*[?？]?$|^(?:what|how|why|when|where|who|which|can|could|should|do|does|is|are|will|would)\b)/i;

// Generic delegation is useful, but it must never be mistaken for a field
// value. Field-specific delegation such as “随便选老师” is intentionally
// excluded: that is a real choice and the field parsers below handle it.
const AUTOFILL_PATTERN =
  /(?:帮我填|替我填|你(?:来|帮我|给我)?填|你(?:来|帮我|给我)?写|你(?:来|帮我|给我)?选|你帮我|你替我|你决定|你来定|你看着办|看着填|随便填|随便写|随便选|随便挑|随便弄|自动填|都用推荐|用推荐值|填上就行|帮我弄|帮我处理|fill it (?:in )?for me|you (?:can )?(?:just )?(?:fill|write|choose|decide|pick)|whatever you think|your choice|auto[- ]?fill)/i;
const EXPLICIT_FIELD_PATTERN =
  /(?:课程名称|课程名字|课程名|课名|名称|名字|老师|教师|卡片|可用卡|会员卡|难度|星级|介绍|约课须知|须知|备注|扣卡|价格|金额|封面|course\s+name|name|teacher|card|level|star|intro|note|price|cover)/i;

// Units and cadence words are never a course name. They are what remains after
// a price or deduction phrase such as “每节扣2次” has been consumed.
const MEASUREMENT_FRAGMENT =
  /^(?:(?:每|单|一|两|这|那|本)\s*)?(?:一\s*)?(?:节|次|课时|天|周|星期|月|个月|年)(?:课)?$/;

function isMeasurementFragment(value: string): boolean {
  return MEASUREMENT_FRAGMENT.test(value.replace(/\s+/g, " ").trim());
}

function isStandaloneName(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 32) return false;
  if (/[\n,，、;；:：!?！？]/.test(text)) return false;
  if (
    /(?:帮我|帮忙|替我|随便|随意|看着|自动|填|写|选|挑|定|决定|推荐|定位|保存|创建|新建|修改|改成|改为|换成|调整|用|要|想|可以|能不能|怎么|什么|如何|哪个|哪里|你|我|来|做|弄|处理|搞定|teacher|course|level|star|card|price|cover|note)/i.test(
      text,
    )
  ) {
    return false;
  }
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function flexiblePattern(value: string): RegExp {
  const chars = [...value.replace(/\s+/g, "")].map((char) => escapeRegExp(char));
  return new RegExp(chars.join("\\s*"), "i");
}

function normalize(input: string): string {
  return input
    .replace(/[，、；;|\n]+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSegment(value: string): string {
  return value.replace(/^[\s:：,，.。!！?？-]+|[\s:：,，.。!！?？-]+$/g, "").trim();
}

function isQuestionLike(value: string): boolean {
  return QUESTION_PATTERN.test(value.trim());
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** A short, course-aware introduction used when the user says “write the intro”. */
export function recommendedIntroFor(name: string, locale: Locale, fallback: string): string {
  const value = name.trim();
  if (locale === "zh") {
    if (/孕|产/.test(value)) return "面向孕期学员的温和练习，关注呼吸、骨盆稳定和身体舒适度。";
    if (/普拉提/.test(value)) return "从核心控制与呼吸开始，建立稳定的发力顺序，适合循序练习。";
    if (/私教/.test(value)) return "一对一定制练习，根据身体情况调整节奏与动作。";
    if (/瑜伽/.test(value)) return "从基础呼吸和体式开始，建立稳定的练习节奏。";
    return fallback;
  }
  if (/pregnan|prenatal/i.test(value)) {
    return "Gentle prenatal practice focused on breathing, pelvic stability, and everyday comfort.";
  }
  if (/pilates/i.test(value)) return "Build control and breathing first, then a steady, repeatable movement pattern.";
  if (/private/i.test(value)) return "A one-to-one session adjusted to the student's body and pace.";
  if (/yoga/i.test(value)) return "Start with breathing and foundational postures, then build a steady practice rhythm.";
  return fallback;
}

export function parseCourseIntake(
  input: string,
  options: CourseIntakeParseOptions,
): CourseIntakeResult {
  const text = normalize(input);
  const patch: CourseIntakePatch = {};
  const recognized: CourseIntakeField[] = [];
  const wantsHelp = HELP_PATTERN.test(text);
  // A question is not a value. This guard is especially important while the
  // page is inviting the user to type the next field: “你会做什么” is a
  // question about the task, not a course name.
  const question = wantsHelp || QUESTION_PATTERN.test(text);
  const autofill = AUTOFILL_PATTERN.test(text) && !EXPLICIT_FIELD_PATTERN.test(text);
  const remember = (field: CourseIntakeField): void => {
    if (!recognized.includes(field)) recognized.push(field);
  };

  const wantsCreate = /(?:创建|新建|新增|建一门|加一门|加个课程|开一门|create\s+(?:a\s+)?course|add\s+(?:a\s+)?course|new\s+course)/i.test(text);
  const wantsSave = /(?:保存|提交|确认保存|确认创建|创建吧|save|submit)/i.test(text);
  const wantsReview = /(?:核对|预览|检查一下|看一下|review|preview)/i.test(text);
  const wantsCancel = /^(?:取消|算了|cancel)/i.test(text);
  const wantsStatus = /(?:还差|还缺|缺什么|还需要什么|what.*missing|what.*left|status)/i.test(text);
  const correction = /(?:改成|改为|换成|换为|变成|调整|修改|更新|改一下|set|change|update)/i.test(text);

  let rest = text;
  rest = rest.replace(
    /^(?:请|帮我|麻烦|我想|我要|想)?\s*(?:创建|新建|新增|加|添加|建|开)\s*(?:一门|一个|个)?\s*(?:课程)?\s*[:：]?\s*/i,
    "",
  );
  rest = rest.replace(/^(?:please\s+)?(?:create|add|new)\s+(?:a\s+)?(?:course)?\s*[:：]?\s*/i, "");

  let autoIntro = false;
  const autoIntroPattern = /(?:介绍|intro|introduction)\s*(?:自动填写|自动生成|自动写|你写|帮我写|自动|auto(?:\s*(?:fill|write|generate))?)|(?:write|fill|generate|自动|帮我写|你写)\s*(?:the\s+)?(?:介绍|intro|introduction)/i;
  if (autoIntroPattern.test(rest)) {
    autoIntro = true;
    rest = rest.replace(autoIntroPattern, " ");
  }

  let explicitIntro = "";
  const introMatch = rest.match(/(?:介绍|intro)\s*[:：]\s*([^,]+)/i);
  if (introMatch) {
    explicitIntro = cleanSegment(introMatch[1]);
    rest = rest.replace(introMatch[0], " ");
  }

  const noteMatch = rest.match(/(?:约课须知|须知|备注|notes?|note)\s*[:：]\s*([^,]+)/i);
  if (noteMatch) {
    const note = cleanSegment(noteMatch[1]);
    if (note) {
      patch.note = note;
      remember("note");
    }
    rest = rest.replace(noteMatch[0], " ");
  }

  let invalidDifficulty: number | undefined;
  const difficultyPatterns = [
    /(?:难度|级别|level)\s*[:：]?\s*(\d+|[一二三四五])\s*(?:星|star|stars)?/i,
    /(\d+|[一二三四五])\s*(?:星|star|stars)/i,
  ];
  for (const pattern of difficultyPatterns) {
    const match = rest.match(pattern);
    if (!match) continue;
    const value = DIFFICULTY_DIGITS[match[1]];
    if (value) {
      patch.difficulty = value;
      remember("difficulty");
    } else {
      invalidDifficulty = Number(match[1]);
    }
    rest = rest.replace(match[0], " ");
    break;
  }

  const pricePatterns = [
    /(?:价格|单价|每节|金额|price)\s*[:：]?\s*[¥￥]?\s*(\d+(?:\.\d+)?)/i,
    /[¥￥]\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:元|块|rmb|cny)/i,
  ];
  for (const pattern of pricePatterns) {
    const match = rest.match(pattern);
    if (!match) continue;
    patch.price = match[1];
    remember("price");
    rest = rest.replace(match[0], " ");
    break;
  }

  const deductMatch = rest.match(/(?:扣卡|扣)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*次/i);
  if (deductMatch) {
    patch.deduct = deductMatch[1];
    remember("deduct");
    rest = rest.replace(deductMatch[0], " ");
  }

  const matchedCards: string[] = [];
  for (const option of options.cardOptions) {
    const pattern = flexiblePattern(option);
    if (!pattern.test(rest)) continue;
    matchedCards.push(option);
    rest = rest.replace(pattern, " ");
  }
  if (matchedCards.length) {
    patch.cards = unique(matchedCards).join(options.locale === "zh" ? " / " : ", ");
    remember("cards");
  }

  let unknownTeacher: string | undefined;
  let ambiguousTeachers: string[] | undefined;
  const anyTeacher = rest.match(
    /(?:(?:老师|教师|teacher)\s*(?:随意|随便|都可以|都行|任意|任选|不限)|(?:随意|随便|任意|任选|any)\s*(?:选|挑|用)?\s*(?:老师|教师|teacher))/i,
  );
  if (anyTeacher) {
    patch.teacherId = options.recommended.teacherId;
    patch.teacherName = options.recommended.teacherName;
    remember("teacher");
    rest = rest.replace(anyTeacher[0], " ");
  }
  const exactTeachers = [...options.teachers]
    .sort((a, b) => b.name.length - a.name.length)
    .filter((teacher) => new RegExp(`${escapeRegExp(teacher.name)}\\s*(?:老师|teacher)?`, "i").test(rest));
  if (exactTeachers.length === 1) {
    const teacher = exactTeachers[0];
    patch.teacherId = teacher.id;
    patch.teacherName = teacher.name;
    remember("teacher");
    rest = rest.replace(new RegExp(`${escapeRegExp(teacher.name)}\\s*(?:老师|teacher)?`, "i"), " ");
  } else if (exactTeachers.length > 1) {
    ambiguousTeachers = exactTeachers.map((teacher) => teacher.name);
    for (const teacher of exactTeachers) {
      rest = rest.replace(new RegExp(`${escapeRegExp(teacher.name)}\\s*(?:老师|teacher)?`, "i"), " ");
    }
  } else {
    const englishToken = options.locale === "en"
      ? rest.split(/[\s,]+/).find((token) => /^[A-Z][a-z]+$/.test(token))
      : undefined;
    if (englishToken) {
      const candidates = options.teachers.filter((teacher) =>
        teacher.name.split(/\s+/).some((part) => part.toLowerCase() === englishToken.toLowerCase()),
      );
      if (candidates.length === 1) {
        const teacher = candidates[0];
        patch.teacherId = teacher.id;
        patch.teacherName = teacher.name;
        remember("teacher");
      } else if (candidates.length > 1) {
        ambiguousTeachers = candidates.map((teacher) => teacher.name);
      }
      rest = rest.replace(new RegExp(`\\b${escapeRegExp(englishToken)}\\b`, "i"), " ");
    }
    const spoken = rest.match(/([\u4e00-\u9fa5]{1,3})\s*老师/i);
    if (spoken) {
      const needle = spoken[1];
      const candidates = options.teachers.filter(
        (teacher) => teacher.name.startsWith(needle) || teacher.name.includes(needle),
      );
      if (candidates.length === 1) {
        const teacher = candidates[0];
        patch.teacherId = teacher.id;
        patch.teacherName = teacher.name;
        remember("teacher");
      } else if (candidates.length > 1) {
        ambiguousTeachers = candidates.map((teacher) => teacher.name);
      } else {
        unknownTeacher = `${needle}老师`;
      }
      rest = rest.replace(spoken[0], " ");
    }
  }

  let explicitName = "";
  const nameMatch = rest.match(
    /(?:课程名称|课程名字|课程名|课名|名称|名字|course\s+name|name)\s*(?:改成|改为|换成|换为|变成|设为|设置成|更新为|是|叫|[:：])\s*([^,]+)/i,
  );
  if (nameMatch) {
    explicitName = cleanSegment(nameMatch[1]);
    rest = rest.replace(nameMatch[0], " ");
  }

  rest = rest.replace(
    /(?:改成|改为|换成|换为|变成|调整成|调整为|修改为|设为|设置成|一下|谢谢|please|thanks|set|change|update)/gi,
    " ",
  );
  const explicitNameIsValue = Boolean(explicitName) && !isQuestionLike(explicitName);
  const candidates = explicitNameIsValue
    ? [explicitName]
    : rest
        .split(",")
        .map(cleanSegment)
        .filter((part) => {
          if (!part || part.length < 2 || part.length > 40) return false;
          if (isQuestionLike(part)) return false;
          if (/^\d+(?:\.\d+)?$/.test(part)) return false;
          if (isMeasurementFragment(part)) return false;
          if (NAME_STOPWORDS.has(part.toLowerCase())) return false;
          if (/^(?:帮我|帮忙|改|修改|调整)/.test(part)) return false;
          if (/(?:老师|课程|难度|星|介绍|月卡|次卡|体验卡|元|扣|封面|备注|teacher|course|level|star|card|price|cover|note)/i.test(part)) return false;
          return true;
        });
  // A bare phrase is only a name when the page has already asked for the name,
  // the user explicitly asked to create a course, an explicit name syntax was
  // used, or another course field was recognised. This prevents ordinary chat
  // and unanswered questions from being written into the course form.
  const hasStructuredEvidence = explicitNameIsValue || wantsCreate || recognized.length > 0;
  const canInferName = hasStructuredEvidence || options.expects === "name";
  if (
    candidates.length &&
    !wantsHelp &&
    !autofill &&
    (!question || hasStructuredEvidence) &&
    canInferName
  ) {
    // A bare answer is accepted only while the page is asking for the name and
    // the whole message looks like a name. Do not turn an imperative sentence
    // such as “你来帮我随便填” into a course name.
    if (options.expects === "name" && !hasStructuredEvidence && !isStandaloneName(rest)) {
      // Leave the field empty; the model will interpret the request.
    } else {
      patch.name = candidates.sort((a, b) => b.length - a.length)[0];
      remember("name");
    }
  }

  if (explicitIntro) {
    patch.intro = explicitIntro;
    remember("intro");
  } else if (autoIntro) {
    patch.intro = recommendedIntroFor(patch.name ?? "", options.locale, options.recommended.intro);
    remember("intro");
  }

  return {
    patch,
    recognized,
    wantsCreate,
    wantsReview,
    wantsSave,
    wantsCancel,
    wantsStatus,
    wantsHelp,
    question,
    autofill,
    correction,
    autoIntro,
    ...(unknownTeacher ? { unknownTeacher } : {}),
    ...(ambiguousTeachers ? { ambiguousTeachers } : {}),
    ...(invalidDifficulty ? { invalidDifficulty } : {}),
  };
}

/**
 * Decide whether this turn should be handled by the page's deterministic
 * command fast path or by the model.
 *
 * The page may safely handle explicit commands and field values it fully
 * understood. Questions, help requests, vague corrections and delegated
 * choices must reach the model, because those need judgment and conversation.
 */
export function shouldUseAgent(result: CourseIntakeResult): boolean {
  if (result.wantsHelp || result.question || result.autofill) return true;
  if (
    result.wantsCancel ||
    result.wantsCreate ||
    result.wantsSave ||
    result.wantsReview ||
    result.wantsStatus
  ) {
    return false;
  }
  if (result.unknownTeacher || result.ambiguousTeachers?.length || result.invalidDifficulty) return false;
  if (Object.keys(result.patch).length > 0) return false;
  // Ordinary chat and vague corrections need the model.
  return true;
}

export function composeCourseIntakeReply(options: CourseIntakeReplyOptions): string {
  const { draft, result } = options;
  const copy = REPLY_COPY[options.locale];
  const labels = FIELD_LABELS[options.locale];
  const parts: string[] = [];

  if (result.recognized.length) {
    const fields = result.recognized.map((field) => labels[field]).join(options.locale === "zh" ? "、" : ", ");
    parts.push((result.correction ? copy.updated : copy.filled).replace("{fields}", fields));
  }

  if (result.unknownTeacher) {
    parts.push(
      copy.unknownTeacher
        .replace("{name}", result.unknownTeacher)
        .replace("{options}", options.teachers.map((teacher) => teacher.name).join(options.locale === "zh" ? "、" : ", ")),
    );
  } else if (result.ambiguousTeachers?.length) {
    parts.push(
      copy.ambiguousTeacher
        .replace("{name}", result.ambiguousTeachers.join(options.locale === "zh" ? " / " : " / "))
        .replace("{options}", result.ambiguousTeachers.join(options.locale === "zh" ? "、" : ", ")),
    );
  }

  if (result.invalidDifficulty) {
    parts.push(copy.invalidDifficulty.replace("{value}", String(result.invalidDifficulty)));
  }

  // A correction that did not map to a field must say so. Asking again is
  // better than silently treating an unclear edit as a fresh instruction.
  if (result.correction && !result.recognized.length) parts.unshift(copy.noChange);

  if (result.wantsHelp || result.question) {
    const missingLabels: string[] = [];
    if (!draft.name.trim()) missingLabels.push(labels.name);
    if (!draft.teacherId) missingLabels.push(labels.teacher);
    if (!draft.cards.trim()) missingLabels.push(labels.cards);

    parts.push(copy.help);
    const untouched =
      !draft.name.trim() &&
      !draft.teacherId &&
      !draft.cards.trim() &&
      !draft.difficulty &&
      !draft.intro.trim() &&
      !draft.note.trim();
    if (untouched) parts.push(copy.helpEmpty);
    else if (missingLabels.length) {
      parts.push(
        copy.helpProgress.replace(
          "{fields}",
          missingLabels.join(options.locale === "zh" ? "、" : ", "),
        ),
      );
    } else if (!draft.cover) {
      parts.push(copy.coverOnly);
    } else {
      parts.push(copy.helpReady);
    }
    parts.push(copy.helpQuestion);
    return parts.join(options.locale === "zh" ? "" : " ");
  }

  const missing: string[] = [];
  if (!draft.name.trim()) missing.push(copy.missingName);
  if (!draft.teacherId && !result.unknownTeacher && !result.ambiguousTeachers?.length) {
    missing.push(
      copy.missingTeacher.replace(
        "{options}",
        options.teachers.map((teacher) => teacher.name).join(options.locale === "zh" ? "、" : ", "),
      ),
    );
  }
  if (!draft.cards.trim()) {
    missing.push(
      copy.missingCards.replace(
        "{options}",
        options.cardOptions.join(options.locale === "zh" ? "、" : ", "),
      ),
    );
  }

  if (missing.length) {
    parts.push(...missing);
    return parts.join(options.locale === "zh" ? "" : " ");
  }

  if (!draft.cover) {
    parts.push(copy.coverOnly);
    return parts.join(options.locale === "zh" ? "" : " ");
  }

  if (!parts.length) parts.push(copy.noChange);
  parts.push(copy.defaults);
  return parts.join(options.locale === "zh" ? "" : " ");
}
