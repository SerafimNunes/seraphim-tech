/**
 * ARQUIVO: frontend/src/app/auth/login/page.tsx
 * PROPÓSITO: Componente de página para a tela de login.
 * CORREÇÃO: Atualizado o caminho de importação de 'useLoginMutation' de '@/features/auth/authApi'
 * para '@/lib/rtk/auth/authApi' para seguir a nova estrutura de Redux/RTK.
 */
import React, { useReducer, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux'; // Módulo 'react-redux'
import { useRouter } from 'next/navigation'; // Módulo 'next/navigation'
import { useLoginMutation } from '@/lib/rtk/auth/authApi'; // CORRIGIDO: Novo caminho da RTK Query
import { z, ZodError } from 'zod';
import { Loader2 } from 'lucide-react';
import { ErrorResponse } from '@/features/types'; // Assumindo que este caminho está correto

// Esquema de Validação Zod para Login
const LoginSchema = z.object({
  email: z.string().email('E-mail inválido.').min(1, 'E-mail é obrigatório.'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

type LoginForm = z.infer<typeof LoginSchema>;

// Tipagem do Estado do Formulário (usado com useReducer)
interface FormState {
  email: string;
  senha: string;
}

// Tipagem para Ações do Reducer
type FormAction =
  | {
      type: 'change';
      field: keyof FormState;
      value: string;
    }
  | {
      type: 'reset';
    };

const formReducer = (prev: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'change':
      return { ...prev, [action.field]: action.value };
    case 'reset':
      return { email: '', senha: '' };
    default:
      return prev;
  }
};

const initialFormState: FormState = {
  email: 'teste@example.com', // Preenchido para facilitar o teste inicial
  senha: 'password', // Preenchido para facilitar o teste inicial
};

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [formData, dispatchForm] = useReducer(formReducer, initialFormState);
  const [formErrors, setFormErrors] = useState<Partial<LoginForm>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [login, { isLoading, isSuccess, error }] = useLoginMutation();

  // Limpa o erro global quando os dados do formulário mudam
  useEffect(() => {
    setGlobalError(null);
  }, [formData]);

  // Redireciona em caso de sucesso
  useEffect(() => {
    if (isSuccess) {
      // O 'setCredentials' é chamado dentro do 'useLoginMutation' transformResponse
      router.push('/dashboard');
    }
  }, [isSuccess, router]);

  // Lógica de manipulação de erro da API
  useEffect(() => {
    if (error) {
      if ('status' in error) {
        // Erro de fetchBaseQuery (inclui 401 Unauthorized)
        const apiError = error.data as ErrorResponse;
        setGlobalError(
          apiError?.message ||
            'Falha na autenticação. Verifique suas credenciais.',
        );
      } else {
        // Erro serializado (pode ser problema de rede)
        setGlobalError('Erro de conexão ou resposta inválida do servidor.');
      }
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setGlobalError(null);

    try {
      // 1. Validação local com Zod
      const validatedData = LoginSchema.parse(formData);

      // 2. Chamada à API
      await login(validatedData).unwrap();

      // O token já é salvo no setCredentials via RTK Query
    } catch (err: unknown) {
      // Erro de validação Zod
      if (err instanceof ZodError) {
        const newErrors: Partial<LoginForm> = {};
        // O ZodError tem a propriedade 'issues'
        err.issues.forEach((issue) => {
          // Acesso seguro ao path do campo
          const field = issue.path[0] as keyof LoginForm;
          if (field) {
            newErrors[field] = issue.message;
          }
        });
        setFormErrors(newErrors);
      } else {
        // Outros erros não tratados acima (o erro da API é tratado no useEffect)
        console.error('Erro desconhecido durante o login:', err);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">
            Chef Intelligence
          </h1>
          <p className="text-gray-500 mt-1">Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mensagem de Erro Global da API */}
          {globalError && (
            <div
              className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md"
              role="alert"
            >
              <p className="font-semibold">Erro de Login</p>
              <p className="text-sm">{globalError}</p>
            </div>
          )}

          {/* Campo E-mail */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              E-mail
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) =>
                  dispatchForm({
                    type: 'change',
                    field: 'email',
                    value: e.target.value,
                  })
                }
                className={`appearance-none block w-full px-4 py-2 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>
            )}
          </div>

          {/* Campo Senha */}
          <div>
            <label
              htmlFor="senha"
              className="block text-sm font-medium text-gray-700"
            >
              Senha
            </label>
            <div className="mt-1">
              <input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                value={formData.senha}
                onChange={(e) =>
                  dispatchForm({
                    type: 'change',
                    field: 'senha',
                    value: e.target.value,
                  })
                }
                className={`appearance-none block w-full px-4 py-2 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ${formErrors.senha ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {formErrors.senha && (
              <p className="mt-1 text-xs text-red-500">{formErrors.senha}</p>
            )}
          </div>

          {/* Botão de Login */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition duration-200 ease-in-out ${
                isLoading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm">
          <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
            Esqueceu sua senha?
          </a>
        </div>
      </div>
    </div>
  );
}
