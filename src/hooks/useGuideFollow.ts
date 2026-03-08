import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { followCreator, unfollowCreator, isFollowing, getFollowerCount } from '@/services/guideFollowsAPI';

export function useGuideFollow(creatorId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const followingQuery = useQuery({
    queryKey: ['is-following', creatorId, userId],
    enabled: !!creatorId && !!userId && creatorId !== userId,
    queryFn: () => isFollowing(creatorId!, userId!),
  });

  const countQuery = useQuery({
    queryKey: ['follower-count', creatorId],
    enabled: !!creatorId,
    queryFn: () => getFollowerCount(creatorId!),
  });

  const followMutation = useMutation({
    mutationFn: () => followCreator(creatorId!, userId!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['is-following', creatorId, userId] });
      await queryClient.cancelQueries({ queryKey: ['follower-count', creatorId] });
      const prevFollowing = queryClient.getQueryData(['is-following', creatorId, userId]);
      const prevCount = queryClient.getQueryData(['follower-count', creatorId]);
      queryClient.setQueryData(['is-following', creatorId, userId], true);
      queryClient.setQueryData(['follower-count', creatorId], (old: number) => (old || 0) + 1);
      return { prevFollowing, prevCount };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['is-following', creatorId, userId], context?.prevFollowing);
      queryClient.setQueryData(['follower-count', creatorId], context?.prevCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['is-following', creatorId, userId] });
      queryClient.invalidateQueries({ queryKey: ['follower-count', creatorId] });
      queryClient.invalidateQueries({ queryKey: ['following', userId] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowCreator(creatorId!, userId!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['is-following', creatorId, userId] });
      await queryClient.cancelQueries({ queryKey: ['follower-count', creatorId] });
      const prevFollowing = queryClient.getQueryData(['is-following', creatorId, userId]);
      const prevCount = queryClient.getQueryData(['follower-count', creatorId]);
      queryClient.setQueryData(['is-following', creatorId, userId], false);
      queryClient.setQueryData(['follower-count', creatorId], (old: number) => Math.max((old || 1) - 1, 0));
      return { prevFollowing, prevCount };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['is-following', creatorId, userId], context?.prevFollowing);
      queryClient.setQueryData(['follower-count', creatorId], context?.prevCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['is-following', creatorId, userId] });
      queryClient.invalidateQueries({ queryKey: ['follower-count', creatorId] });
      queryClient.invalidateQueries({ queryKey: ['following', userId] });
    },
  });

  return {
    isFollowing: followingQuery.data ?? false,
    followerCount: countQuery.data ?? 0,
    isLoading: followingQuery.isLoading,
    toggleFollow: () => {
      if (followingQuery.data) {
        unfollowMutation.mutate();
      } else {
        followMutation.mutate();
      }
    },
    canFollow: !!userId && !!creatorId && creatorId !== userId,
  };
}
