import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";

interface ErrorScreenProps {
  message: string;
  onHome: () => void;
}

// 방 밖에서 방에 있을 수 없게 된 경우(내보내짐, 방 닫힘)의 화면. 입장 배경 위 가운데에 사유 한 문장과 [처음으로] 뿐이고 진홍은 쓰지 않는다.
export function ErrorScreen({ message, onHome }: ErrorScreenProps) {
  return (
    <Backdrop layout="entry" scene="lobby">
      <main className="mf-root mf-entry mf-error">
        <div className="mf-error__body">
          <h1 className="mf-t-heading mf-error__message">{message}</h1>
          <Button variant="primary" block onClick={onHome}>
            처음으로
          </Button>
        </div>
      </main>
    </Backdrop>
  );
}
