// Update this page (the content is just a fallback if generation does not replace it)

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl">Welcome</CardTitle>
          <CardDescription className="text-base">
            Your blank ZeroOps vibe app is ready. Replace this page to start
            building.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button type="button">Get started</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
