import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { signIn, signUp, isValidMongolianPhone } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { Package, Phone, Lock, ArrowLeft } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone
    if (!isValidMongolianPhone(phone)) {
      toast({
        title: 'Алдаа',
        description: 'Утасны дугаар буруу байна. 8 оронтой дугаар оруулна уу.',
        variant: 'destructive',
      });
      return;
    }

    // Validate password
    if (password.length < 6) {
      toast({
        title: 'Алдаа',
        description: 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.',
        variant: 'destructive',
      });
      return;
    }

    // Validate confirm password for signup
    if (!isLogin && password !== confirmPassword) {
      toast({
        title: 'Алдаа',
        description: 'Нууц үг таарахгүй байна.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(phone, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Нэвтрэх алдаа',
              description: 'Утасны дугаар эсвэл нууц үг буруу байна.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Алдаа',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Амжилттай',
            description: 'Амжилттай нэвтэрлээ!',
          });
          navigate('/');
        }
      } else {
        const { error } = await signUp(phone, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Алдаа',
              description: 'Энэ утасны дугаар бүртгэлтэй байна. Нэвтрэх хэсгээр орно уу.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Алдаа',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Амжилттай бүртгэгдлээ',
            description: 'Таны бүртгэл амжилттай үүслээ!',
          });
          navigate('/');
        }
      }
    } catch (err) {
      toast({
        title: 'Алдаа',
        description: 'Сүлжээний алдаа гарлаа. Дахин оролдоно уу.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {isLogin ? 'Нэвтрэх' : 'Бүртгүүлэх'}
          </h1>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {isLogin ? 'Тавтай морил' : 'Бүртгүүлэх'}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Утасны дугаараар нэвтрэх'
                : 'Шинэ хэрэглэгч бүртгүүлэх'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Утасны дугаар</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="99112233"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    maxLength={8}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Нууц үг</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Нууц үг давтах</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isLogin ? (
                  'Нэвтрэх'
                ) : (
                  'Бүртгүүлэх'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-sm text-primary hover:underline"
              >
                {isLogin
                  ? 'Бүртгэл байхгүй юу? Бүртгүүлэх'
                  : 'Бүртгэлтэй юу? Нэвтрэх'}
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
