//backend/src/controllers/RHController.ts
import { Request, Response } from 'express';
import { RHService } from '../services/RHService';
// 🔑 CORRIGIDO: Certifica-se de importar o EscalaService corretamente (exportado como Named Export)
import { EscalaService } from '../services/EscalaService';
import { StatusCodes } from 'http-status-codes';
import { z, ZodError } from 'zod';

import {
    IPerfilIdeal,
    IHistoricoPerformance,
} from '../config/types';

const perfilIdealSchema = z.object({
    cargo_id: z.number().int().positive(),
    competencia_id: z.number().int().positive(),
});

const performanceSchema = z.object({
    colaborador_id: z.number().int().positive(),
    erros_registrados: z.number().nonnegative(),
    desperdicio_total: z.number().nonnegative(),
});

export class RHController {
    private rhService: RHService;
    private escalaService: EscalaService;

    // 🔑 O Construtor recebe 2 argumentos, compatível com index.ts
    constructor(rhServiceInstance: RHService, escalaServiceInstance: EscalaService) {
        this.rhService = rhServiceInstance;
        this.escalaService = escalaServiceInstance;
    }

    public getTurnoverAnalysis = async (req: Request, res: Response): Promise<Response> => {
        try {
            const querySchema = z.object({
                unidade_id: z.preprocess(
                    (a) => parseInt(z.string().parse(a), 10),
                    z.number().int().positive(),
                ),
                ano: z.preprocess(
                    (a) => parseInt(z.string().parse(a), 10),
                    z.number().int().min(2000).max(new Date().getFullYear()),
                ),
            });

            const { unidade_id, ano } = querySchema.parse(req.query);
            const turnoverData = await this.rhService.getTurnoverAnalysis(unidade_id, ano);

            return res.status(StatusCodes.OK).json(turnoverData);
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Erro de Validação nos parâmetros de consulta (Query Params).',
                    details: error.issues,
                });
            }
            console.error('[RHController] Erro ao buscar Turnover:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: (error as Error).message || 'Falha ao carregar análise de Turnover.',
            });
        }
    }

    public definirPerfilIdeal = async (req: Request, res: Response): Promise<Response> => {
        try {
            const perfil = perfilIdealSchema.parse(req.body);
            await this.rhService.definirPerfilIdeal(perfil as IPerfilIdeal);

            return res.status(StatusCodes.CREATED).json({
                message: 'Perfil ideal definido (GPR-3: Lógica não implementada).',
            });
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Erro de Validação no Perfil Ideal.',
                    details: error.issues,
                });
            }
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: (error as Error).message || 'Falha ao definir perfil ideal.',
            });
        }
    };

    public registrarPerformance = async (req: Request, res: Response): Promise<Response> => {
        try {
            const performance = performanceSchema.parse(req.body);
            await this.rhService.registrarPerformance(performance as IHistoricoPerformance);

            return res.status(StatusCodes.CREATED).json({
                message: 'Performance registrada (GPR-3: Lógica não implementada).',
            });
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Erro de Validação na Performance.',
                    details: error.issues,
                });
            }
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: (error as Error).message || 'Falha ao registrar performance.',
            });
        }
    };

    async criarEscala(req: Request, res: Response): Promise<Response> {
        return res.status(StatusCodes.NOT_IMPLEMENTED).json({
            message: 'A rota de criação de escala deve ser acessada via /api/escala/ (EscalaController)',
        });
    }

    async aprovarEscala(req: Request, res: Response): Promise<Response> {
        try {
            const escalaId = Number(req.params.id);

            const gerenteId = z
                .object({ gerente_id: z.number().int().positive() })
                .parse(req.body).gerente_id;

            if (!escalaId || escalaId <= 0) {
                return res
                    .status(StatusCodes.BAD_REQUEST)
                    .json({ message: 'ID de escala inválido.' });
            }

            const escalaAprovada = await this.escalaService.aprovarEscala(escalaId, gerenteId);

            return res.status(StatusCodes.OK).json({
                message: 'Escala aprovada com sucesso.',
                escala: escalaAprovada,
            });
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Erro de Validação: ID do Gerente inválido.',
                    details: error.issues,
                });
            }
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: (error as Error).message || 'Falha ao aprovar escala.',
            });
        }
    }
}