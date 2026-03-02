import { db } from "@/lib/firebase";
import { doc, increment, setDoc, updateDoc } from "firebase/firestore";

export async function saveBirthDate(uid: string, birthDateISO: string) {
  // birthDateISO: YYYY-MM-DD
  await setDoc(
    doc(db, "users", uid),
    {
      birthDate: birthDateISO,
      updatedAt: Date.now(),
      version: increment(1),
    },
    { merge: true }
  );
}

export async function saveCompass(uid: string, compass: { mission: string; vision: string; values: string }) {
  await updateDoc(doc(db, "users", uid), {
    compass,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function saveFocusCurrent(
  uid: string,
  focus: { title: string; description: string; priorities: Array<{ id: string; label: string }> }
) {
  await updateDoc(doc(db, "users", uid), {
    focusCurrent: focus,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function clearFocusCurrent(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    focusCurrent: null,
    updatedAt: Date.now(),
    version: increment(1),
  });
}
