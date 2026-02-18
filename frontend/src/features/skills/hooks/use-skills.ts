import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { skillsApi } from '../api'
import { useSkillsStore } from '../store'
import type { SkillInput } from '../types'

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
    staleTime: 30000,
  })
}

export function useSkill(id: string | undefined) {
  return useQuery({
    queryKey: ['skills', id],
    queryFn: () => skillsApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  const { closeModal } = useSkillsStore()

  return useMutation({
    mutationFn: (input: SkillInput) => skillsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      toast.success('Skill criada com sucesso!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao criar skill')
    },
  })
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()
  const { closeModal } = useSkillsStore()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SkillInput> }) =>
      skillsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      toast.success('Skill atualizada!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao atualizar skill')
    },
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: skillsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      toast.success('Skill excluida!')
    },
    onError: () => {
      toast.error('Erro ao excluir skill')
    },
  })
}

export function useToggleSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: skillsApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}
