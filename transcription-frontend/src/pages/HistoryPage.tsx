import { useNavigate } from "react-router-dom";
import { MediaHistory } from "@/components/MediaHistory";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function HistoryPage() {
    const navigate = useNavigate();

    const { user } = useAuth();

    if (!user) {
        navigate("/login");
    }

    return (
        <div className="container mx-auto max-w-4xl p-8">
            <div className="flex items-center gap-4 mb-6">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate("/")}
                    title="Back to upload"
                >
                    <ArrowLeft size={18} />
                </Button>
                <h1 className="text-2xl font-bold">Media History</h1>
            </div>
            <MediaHistory />
        </div>
    );
}
