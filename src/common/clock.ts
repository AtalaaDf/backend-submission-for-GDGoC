let mockedTime: Date | null = null;

export const clock = {
  now(): Date {
    return mockedTime ? new Date(mockedTime.getTime()) : new Date();
  },

  setMockTime(time: Date | string | null): void {
    if (time === null) {
      mockedTime = null;
    } else {
      mockedTime = typeof time === "string" ? new Date(time) : time;
    }
  },

  reset(): void {
    mockedTime = null;
  },
};
