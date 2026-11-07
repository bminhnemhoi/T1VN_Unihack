import { CreateCircleForm } from '@/components/CreateCircleForm';

/** S03: create a circle. Numbers on the right update as you type. */
export default function NewCircle() {
  return (
    <main>
      <h1 className="text-3xl font-bold">Tạo dây</h1>
      <p className="mt-1 mb-6 max-w-prose text-muted-foreground">
        Nhập số của dây. Chỉ số bảo chứng và trần thăm tự cập nhật khi bạn gõ.
      </p>
      <CreateCircleForm />
    </main>
  );
}
