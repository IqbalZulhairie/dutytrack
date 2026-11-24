export type Staff = {
  id: string;
  name: string;
  email: string;
  staffId?: string;
  active: boolean;
};

export type CleaningTask = {
  id: string;
  label: string;
  description: string;
  active: boolean;
};

export type Duty = {
  id: string;
  date: string;
  staffIds: string[];
  taskIds: string[];
  completedTaskIds: string[];
};

export type Store = {
  staff: Staff[];
  duties: Duty[];
  tasks: CleaningTask[];
  reminderTime: string;
};
