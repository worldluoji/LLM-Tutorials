import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, precision_recall_curve, average_precision_score
from sklearn.preprocessing import label_binarize

# load data
datafile_path = "/Users/honorluo/Downloads/fine_food_reviews_with_embeddings_1k.csv"

df = pd.read_csv(datafile_path)
df["embedding"] = df.embedding.apply(eval).apply(np.array)  # convert string to array

# split data into train and test
X_train, X_test, y_train, y_test = train_test_split(
    list(df.embedding.values), df.Score, test_size=0.2, random_state=42
)

# train random forest classifier
clf = RandomForestClassifier(n_estimators=100)
clf.fit(X_train, y_train)
preds = clf.predict(X_test)
probas = clf.predict_proba(X_test)

report = classification_report(y_test, preds)
print(report)


def plot_multiclass_precision_recall(y_score, y_true, classes):
    """Per-class P/R 曲线，替代 OpenAI 0.x 的 openai.embeddings_utils.plot_multiclass_precision_recall。"""
    import matplotlib.pyplot as plt

    y_true_bin = label_binarize(y_true, classes=classes)
    for i, cls in enumerate(classes):
        precision, recall, _ = precision_recall_curve(y_true_bin[:, i], y_score[:, i])
        ap = average_precision_score(y_true_bin[:, i], y_score[:, i])
        plt.plot(recall, precision, label=f"Score {cls} (AP={ap:.2f})")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Multiclass Precision-Recall")
    plt.legend()
    plt.show()


plot_multiclass_precision_recall(probas, y_test, [1, 2, 3, 4, 5])
