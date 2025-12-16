"use client";

import { createContext, useContext } from "react";

interface CommentEditContextValue {
  markUserEdited: (commentId: string) => void;
}

export const CommentEditContext = createContext<CommentEditContextValue>({
  markUserEdited: () => {},
});

export const useCommentEdit = () => useContext(CommentEditContext);
