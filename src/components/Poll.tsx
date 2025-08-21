import { useEffect, useState } from 'react';
import { Poll as PollType, getPollForViewer, voteInPoll } from '../lib/database';
import { useAuth } from '../hooks/useAuth';

interface PollProps {
	postId: string;
}

export function Poll({ postId }: PollProps) {
	const { user } = useAuth();
	const [poll, setPoll] = useState<PollType | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		let active = true;
		(async () => {
			const p = await getPollForViewer(postId, user?.userId);
			if (active) setPoll(p);
		})();
		return () => { active = false; };
	}, [postId, user?.userId]);

	if (!poll) return null;

	const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
	const hasVoted = poll.viewer_vote_index !== null && poll.viewer_vote_index !== undefined;

	const onVote = async (idx: number) => {
		if (!user) return;
		setSubmitting(true);
		try {
			const updated = await voteInPoll(postId, idx, user.userId);
			setPoll(updated);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="mt-3 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
			<div className="px-3 py-2 font-mono text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
				{poll.question}
			</div>
			<div className="divide-y divide-gray-200 dark:divide-gray-800">
				{poll.options.map((opt) => {
					const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
					const isSelected = poll.viewer_vote_index === opt.index;
					const hasVotes = opt.votes > 0;
					
					return (
						<button
							key={opt.index}
							onClick={() => onVote(opt.index)}
							disabled={submitting}
							className={`w-full text-left px-3 py-3 font-mono text-sm flex items-center gap-3 transition-all duration-200 ${
								isSelected 
									? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' 
									: hasVoted 
										? 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50' 
										: 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
							}`}
						>
							{/* Radio button */}
							<div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
								isSelected 
									? 'border-blue-500 bg-blue-500' 
									: 'border-gray-400 dark:border-gray-500'
							}`}>
								{isSelected && (
									<div className="w-2 h-2 bg-white rounded-full m-auto"></div>
								)}
							</div>
							
							{/* Option text */}
							<span className={`flex-1 ${
								isSelected 
									? 'text-blue-900 dark:text-blue-100 font-medium' 
									: 'text-gray-800 dark:text-gray-100'
							}`}>
								{opt.text}
							</span>
							
							{/* Vote count and percentage */}
							{hasVoted && (
								<div className={`text-right ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
									<div className="font-medium">{percentage}%</div>
									<div className="text-xs">({opt.votes})</div>
								</div>
							)}
						</button>
					);
				})}
			</div>
			
			{/* Poll footer */}
			{hasVoted && (
				<div className="px-3 py-2 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
					{totalVotes} vote{totalVotes !== 1 ? 's' : ''} total
					{poll.closes_at && (
						<span className="ml-3">• closes {new Date(poll.closes_at).toLocaleString()}</span>
					)}
				</div>
			)}
		</div>
	);
} 