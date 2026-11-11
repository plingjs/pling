export type TeacherStatus = "active" | "inactive";
export type LessonStatus = "scheduled" | "cancelled" | "completed";
export type BookingStatus = "booked" | "checked-in" | "no-show";

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  specialties: string[];
  status: TeacherStatus;
  introduction?: string;
  yearsExperience?: string;
  privateEligible?: boolean;
  avatarName?: string;
}

export interface Course {
  id: string;
  name: string;
  category: string;
  teacherId: string;
  cardTemplateId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  duration: number;
  price: number;
  intro: string;
  status: "published" | "draft";
  bookingNotice?: string;
  coverName?: string;
  deductionCount?: number;
  deductionAmount?: number;
  room?: string;
  capacity?: number;
  minimumEnrollment?: number;
  autoCancelBelowMinimum?: boolean;
  cancelBeforeMinutes?: number;
  bookingOpensMinutes?: number;
  bookingClosesMinutes?: number;
  notifications?: number[];
  homepageVisible?: boolean;
  postBookingInfo?: string[];
}

export interface CardTemplate {
  id: string;
  name: string;
  sessions: number;
  price: number;
  validityDays: number;
  applicable: string;
  kind?: "limited-count" | "unlimited" | "stored-value";
  storedValue?: number;
  maxPerStudent?: number;
  opensImmediately?: boolean;
  allowGuestBooking?: boolean;
  bookingNotice?: string;
}

export interface StudentCard {
  id: string;
  studentId: string;
  templateId: string;
  remaining: number;
  expiresOn: string;
  status: "pending" | "active" | "exhausted" | "expired";
  balance?: number;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  joinedOn: string;
  cards: StudentCard[];
}

export interface Lesson {
  id: string;
  courseId: string;
  teacherId: string;
  date: string;
  start: string;
  duration: number;
  room: string;
  capacity: number;
  booked: number;
  status: LessonStatus;
}

export interface Booking {
  id: string;
  studentId: string;
  lessonId: string;
  status: BookingStatus;
}

export interface PrivateAvailability {
  id: string;
  teacherId: string;
  date: string;
  start: string;
  end: string;
  status: "available" | "booked";
}

export interface PrivateBooking {
  id: string;
  availabilityId: string;
  teacherId: string;
  courseId: string;
  studentId: string;
  cardId: string;
  status: "booked" | "checked-in" | "cancelled";
}

export interface WorkspaceData {
  teachers: Teacher[];
  courses: Course[];
  cardTemplates: CardTemplate[];
  students: Student[];
  lessons: Lesson[];
  bookings: Booking[];
  privateAvailability: PrivateAvailability[];
  privateBookings: PrivateBooking[];
}

export interface CreateCourseInput {
  name: string;
  category: string;
  teacherId: string;
  cardTemplateId: string;
  difficulty: number;
  duration: number;
  price: number;
  intro: string;
  bookingNotice?: string;
  coverName?: string;
  deductionCount?: number;
  deductionAmount?: number;
  room?: string;
  capacity?: number;
  minimumEnrollment?: number;
  autoCancelBelowMinimum?: boolean;
  cancelBeforeMinutes?: number;
  bookingOpensMinutes?: number;
  bookingClosesMinutes?: number;
  notifications?: number[];
  homepageVisible?: boolean;
  postBookingInfo?: string[];
}

export interface CreateLessonInput {
  courseId: string;
  teacherId: string;
  date: string;
  start: string;
  duration: number;
  room: string;
  capacity: number;
}

export interface CreateAvailabilityInput {
  teacherId: string;
  date: string;
  start: string;
  end: string;
}

export interface BookPrivateLessonInput {
  availabilityId: string;
  courseId: string;
  studentQuery: string;
}

export interface CreateCardTemplateInput {
  name: string;
  kind: "limited-count" | "unlimited" | "stored-value";
  price: number;
  sessions: number;
  validityDays: number;
  applicable: string;
  maxPerStudent: number;
  allowGuestBooking: boolean;
  opensImmediately: boolean;
  bookingNotice: string;
  storedValue?: number;
}
