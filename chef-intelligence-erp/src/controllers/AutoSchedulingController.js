// src/controllers/AutoSchedulingController.js

const { connection } = require('../config/sequelize');
const { Op } = require('sequelize');

const Colaborador = require('../models/Colaborador');
const Escala = require('../models/Escala');

// 💡 Helper: Função para verificar se a restrição é violada
const checkRestricoes = (restricoes, data_escala) => {
    if (!restricoes) return false;

    const restricoesArray = restricoes.split(',').map(r => r.trim().toUpperCase());
    const diaDaSemana = new Date(data_escala).getDay(); // 0 (Domingo) a 6 (Sábado)

    // Exemplo de Restrições:
    // 'SABADO'
    // 'DOMINGO'
    // 'NAO_DISPONIVEL_SEMANA'

    if (diaDaSemana === 6 && restricoesArray.includes('SABADO')) return true; // Joana Adventista
    if (diaDaSemana === 0 && restricoesArray.includes('DOMINGO')) return true;
    
    // Outras lógicas de restrição mais complexas podem ser adicionadas aqui.
    return false;
};

class AutoSchedulingController {

    /**
     * Gera a Escala de Trabalho automaticamente para um período.
     * Rota: POST /api/v1/rh/auto-schedule
     * @body { data_inicio, data_fim, versao_escala, turnos_por_dia }
     */
    async generateSchedule(req, res) {
        const { data_inicio, data_fim, versao_escala, turnos_por_dia } = req.body;
        
        if (!data_inicio || !data_fim || !turnos_por_dia) {
            return res.status(400).json({ error: 'Datas e definição de turnos são obrigatórios.' });
        }

        const transaction = await connection.transaction();

        try {
            // 1. CRÍTICO: Buscar todos os colaboradores ativos, ordenados por senioridade (melhores primeiro)
            const colaboradores = await Colaborador.findAll({
                where: { ativo: true },
                order: [['nivel_senioridade', 'DESC']],
                transaction
            });

            if (colaboradores.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Nenhum colaborador ativo encontrado para escalar.' });
            }

            // 2. Cria um mapa de colaboradores e seus horários (para controle de horas trabalhadas)
            const controleHoras = colaboradores.map(c => ({
                id: c.id_colaborador,
                nome: c.nome,
                funcao: c.funcao,
                restricoes: c.restricoes_individuais,
                horas_trabalhadas: 0,
                escalas: [],
            }));

            const escalasGeradas = [];
            let dataAtual = new Date(data_inicio);
            const dataFimLimite = new Date(data_fim);

            // 3. Loop principal: Itera por dia
            while (dataAtual <= dataFimLimite) {
                const data_escala = dataAtual.toISOString().split('T')[0]; // Formato YYYY-MM-DD

                // Itera pelos turnos definidos no input (ex: 8:00-16:00, 16:00-00:00)
                for (const turno of turnos_por_dia) {
                    const { hora_entrada, hora_saida, funcao_requerida } = turno;
                    const duracaoHoras = (new Date(`2000-01-01T${hora_saida}`) - new Date(`2000-01-01T${hora_entrada}`)) / 3600000;

                    // Tenta encontrar um colaborador para este turno
                    let colaboradorEscalado = null;
                    
                    // Prioriza colaboradores que:
                    // a) Tenham a função requerida (ou qualquer função se não for especificada)
                    // b) Não tenham restrições no dia
                    // c) Tenham menos horas trabalhadas até o momento
                    const candidatos = controleHoras
                        .filter(c => 
                            (!funcao_requerida || c.funcao === funcao_requerida) &&
                            !checkRestricoes(c.restricoes, data_escala)
                        )
                        .sort((a, b) => a.horas_trabalhadas - b.horas_trabalhadas); // Prioriza quem trabalhou menos

                    if (candidatos.length > 0) {
                        colaboradorEscalado = candidatos[0]; // O mais qualificado e menos sobrecarregado

                        // Registra a escala (Simulação no array)
                        colaboradorEscalado.horas_trabalhadas += duracaoHoras;
                        colaboradorEscalado.escalas.push({ data_escala, hora_entrada, hora_saida });
                        
                        // Cria a entrada de Escala para o banco de dados
                        escalasGeradas.push({
                            id_colaborador: colaboradorEscalado.id,
                            data_escala,
                            hora_entrada,
                            hora_saida,
                            versao_escala,
                            status_aprovacao: 'RASCUNHO', // Sempre inicia como rascunho
                        });
                    }
                }
                
                dataAtual.setDate(dataAtual.getDate() + 1); // Avança para o próximo dia
            }

            // 4. Salva todas as escalas geradas no banco de dados
            await Escala.bulkCreate(escalasGeradas, { transaction });

            await transaction.commit();

            return res.status(201).json({
                message: `Sucesso! ${escalasGeradas.length} escalas geradas para a versão ${versao_escala} e salvas como RASCUNHO.`,
                colaboradores_escalados: controleHoras.map(c => ({
                    nome: c.nome,
                    horas_estimadas: c.horas_trabalhadas.toFixed(2)
                }))
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NO AUTO-SCHEDULING:', error);
            return res.status(500).json({ error: 'Erro ao gerar escala automática.', details: error.message });
        }
    }
}

module.exports = new AutoSchedulingController();